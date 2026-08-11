# Forming Paws — Slice B: Owner Conversations

**Date:** 2026-08-11
**Status:** Approved

## Problem

A mutual match currently leads nowhere.

The trigger in migration 0011 creates a `matches` row when both owners express interest, `/matches` lists it — and that is the end of the product. There is no way for the two owners to say anything to each other. [app/matches/page.tsx:36](../../../app/matches/page.tsx) says so out loud: *"Chat is coming in a later slice."*

Meanwhile the public landing page promises three things we do not have:

> in-app chat, neutral meetup guidance, report tools

and:

> Express interest — when it's mutual, **chat unlocks** so owners can talk first.

So the core loop terminates one step before it delivers value, and the site describes a feature that does not exist. There is 1 real match in the database today, which will become several as the five newly-unblocked members start browsing.

## Goal

Two owners with a mutual match can hold a conversation in the product, know when they have unread messages, and get out safely if it goes wrong.

## Non-goals

- Email or push notifications on new messages. Unread badges only.
- Realtime websockets. Polling, for reasons set out below.
- Editing or deleting individual messages.
- Group conversations. Every thread is exactly two owners.
- Attachments, images, or read receipts.
- Blocking a *person* platform-wide. Blocking is scoped to one conversation.
- Neutral meetup guidance and the record-exchange checklist — content work, separate slice.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Delivery | Polling while the thread is open | 7 members, 1 match. Reuses the server component's query path, so there is one RLS surface instead of two. Schema is identical to the Realtime design, so this is reversible without a migration. |
| Notifications | In-app unread badges | No sending infrastructure, no deliverability risk. |
| Admin access to messages | Only while a report on that conversation is `open` or `reviewing` | Enough to act on an incident without making every private message staff-readable. |
| Safety features | Report **and** block ship with chat | The platform introduces strangers who then meet in person with animals. Shipping the channel without an exit is the gap least worth leaving open. |
| Message mutability | Immutable | A reported conversation must not be editable after the fact. |
| Conversation identity | Owner-to-owner, keyed by match | A match is between two dogs, but people do the talking. |

## Why polling rather than Realtime

The `supabase_realtime` publication is currently **empty** — verified against the live database — so Realtime is net-new infrastructure, not a switch to flip.

Against that: this repository has been bitten three separate times by PostgREST embedded selects being silently filtered by an unrelated table's RLS (`/matches`, the original browsable-dogs design, the admin review queue). Realtime's `postgres_changes` is a second, differently-behaved RLS surface. Polling reuses the same queries the server component already runs, which is one surface that is already understood.

At 7 members a 5-second poll while a thread is open is indistinguishable from live. If the member count grows to where that matters, upgrading means publishing `messages` to the realtime publication and swapping the fetch hook. **No schema change.**

## Schema — migration 0020

```sql
create type public.report_reason as enum (
  'harassment', 'spam', 'animal_welfare', 'suspected_fake_documents', 'other'
);

create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_owner_id uuid not null references public.owners(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_match_created_idx on public.messages (match_id, created_at);

create table public.match_reads (
  match_id uuid not null references public.matches(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (match_id, owner_id)
);

create table public.match_blocks (
  match_id uuid not null references public.matches(id) on delete cascade,
  blocker_owner_id uuid not null references public.owners(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, blocker_owner_id)
);

create table public.match_reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  reporter_owner_id uuid not null references public.owners(id) on delete cascade,
  reason public.report_reason not null,
  detail text check (detail is null or length(btrim(detail)) between 1 and 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_notes text
);

create index match_reports_status_idx on public.match_reports (status, created_at);
```

`match_reports` deliberately mirrors the shape of `health_documents` — `status` / `reviewed_at` / `reviewer_notes` — so the admin queue reads the same way as the one that already exists.

## Access control

Two `security definer` helpers keep the policies readable and keep the dogs join in exactly one place:

```sql
create or replace function public.owner_in_match(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches m
    join public.dogs d on d.id in (m.dog_a_id, m.dog_b_id)
    where m.id = p_match_id and d.owner_id = auth.uid()
  );
$$;

create or replace function public.match_is_blocked(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.match_blocks b where b.match_id = p_match_id);
$$;
```

Both must have `EXECUTE` revoked from `anon` and `public`, then granted to `authenticated` — migration 0010 exists because Supabase's default grants were missed once already.

| Table | SELECT | INSERT | UPDATE / DELETE |
|---|---|---|---|
| `messages` | `owner_in_match(match_id)` **or** admin-with-open-report (below) | `owner_in_match(match_id)` and `sender_owner_id = auth.uid()` and **not** `match_is_blocked(match_id)` | none — immutable |
| `match_reads` | `owner_id = auth.uid()` | same | UPDATE own only |
| `match_blocks` | `owner_in_match(match_id)` | `owner_in_match` and `blocker_owner_id = auth.uid()` | DELETE own only (unblock) |
| `match_reports` | own reports, or `is_admin()` | `owner_in_match` and `reporter_owner_id = auth.uid()` | UPDATE admin only |

The admin read rule on `messages`:

```sql
or (
  public.is_admin()
  and exists (
    select 1 from public.match_reports r
    where r.match_id = messages.match_id
      and r.status in ('open', 'reviewing')
  )
)
```

Access **begins** when a report is filed and **ends** when it is resolved or dismissed. Reopening a report restores it.

## Behaviour

**Sending.** A server action inserts the message. The composer is disabled when the thread is blocked. Insert is rejected at the database level too, so a stale client cannot post into a blocked thread.

**Unread.** Unread for a match = messages with `created_at > last_read_at` whose `sender_owner_id` is not me. With no `match_reads` row, everything not sent by me is unread. Opening a thread upserts `last_read_at = now()`.

**Polling.** The thread page server-renders the existing messages. A client component then fetches messages newer than the last one it holds, every 5 seconds, and only while the tab is visible — `document.visibilityState` gates the interval so a background tab stops polling. Sent messages render optimistically and reconcile on the next fetch.

A blocked thread still reports its unread count, and opening it still marks it read. Unread is a property of messages already sent, not of whether the thread accepts new ones — suppressing the badge would hide messages that arrived before the block.

**Blocking.** Either party can block. The thread becomes read-only **for both**. The blocker sees "You closed this conversation" with an unblock control. The other party sees "This conversation is no longer available" — deliberately not naming who closed it or why, so blocking does not invite an offline confrontation. Existing messages stay visible to both; hiding them would destroy the evidence a report depends on.

**Reporting.** Reason (enum) plus optional detail. Filing a report does not automatically block — they are separate acts, and the UI offers both. A confirmation makes clear a human will read the conversation.

**Admin queue.** `/admin/reports` lists open reports newest-first, links to the conversation, and allows setting status with notes. It reuses the pattern in `app/admin/review-queue/`.

## The trap this design routes around

Showing the other dog's name in a thread means reaching `dogs`, which is owner-gated by RLS. A PostgREST embedded select through it returns silently-empty rows for the *other* owner's dog — the bug that has now hit `/matches`, the browsable-dogs design, and the admin review queue.

**Every dog-name lookup in this slice goes through `dogs_browsable` with a batch id fetch**, never an embedded select through `dogs`. This applies to the matches list, the thread header, and the admin queue.

### The same trap, for owners — and why the UI is built around it

`owners` has an RLS policy of *your own row, or admin*. **The other owner's `display_name` is therefore unreadable to you**, and any attempt to render "chatting with Sarah" would silently produce an empty string.

Two ways out: expose owner names through a view the way `dogs_browsable` exposes dogs, or do not use owner names at all.

**This design does not use owner names.** Participants are identified by their **dog**: the thread header reads "Luna ↔ Duke", and each message is labelled "You" or the other dog's name, decided by comparing `sender_owner_id` against the viewer's own id. No owner identity is needed anywhere in the UI.

That is the smaller change, and it is also the better one — it keeps a members' real name out of a surface shared with someone they have not met, which matches the local-first, distance-only posture of the rest of the product. Adding an owner-name view would be a privacy expansion adopted for a cosmetic reason.

## Files

| Path | Responsibility |
|---|---|
| `supabase/migrations/0020_owner_conversations.sql` | Tables, enums, helpers, policies, grants |
| `lib/chat/unread.ts` | Pure unread-count logic — unit tested |
| `app/matches/page.tsx` | List with unread badge and last-message preview |
| `app/matches/[id]/page.tsx` | Thread — server-rendered, auth-gated |
| `app/matches/[id]/Thread.tsx` | Client: polling, optimistic send, visibility gating |
| `app/matches/[id]/actions.ts` | Server actions: send, markRead, block, unblock, report |
| `app/admin/reports/page.tsx` | Report queue |
| `app/admin/reports/actions.ts` | Status transitions |
| `app/privacy/page.tsx` | New section on messages |
| `app/terms/page.tsx` | One line on conduct and review |

## Privacy policy update — required, not optional

The policy shipped yesterday says reviewers can see veterinary documents and the member roster. It says **nothing** about messages. Shipping this without amending it would make a live policy inaccurate on the day it ships.

The new section must state plainly: messages are private to the two owners; staff cannot read them; the single exception is a conversation someone has reported, which a reviewer may read while the report is open, and access ends when it is closed. Also that messages are retained for the life of the account and removed on deletion.

## Testing

- **Unit:** unread counting (no reads row, all read, mixed, own messages never unread); message body validation at the 1 and 2000 boundaries.
- **Database, in rolled-back transactions** (the pattern used to verify migration 0019):
  - a third owner cannot select messages in someone else's match
  - a non-admin cannot select messages in a reported match
  - an admin **can**, while status is `open`, and **cannot** once `resolved`
  - insert into a blocked thread is rejected
  - `sender_owner_id` spoofing is rejected
- **E2E** (Playwright, both fixture owners): express mutual interest → thread appears → send → other owner sees it and their badge clears on open → block → composer disabled for both.

## Risks

| Risk | Mitigation |
|---|---|
| RLS filtering surprise on dog names | Everything through `dogs_browsable`, batch id fetch. Called out per file. |
| Polling wastes requests in idle tabs | Interval gated on `document.visibilityState`; stops when hidden. |
| Admin over-reach on private messages | Access scoped to open reports by policy, not by UI. |
| Block used to hide evidence | Messages remain readable to both parties and to a reviewer on a report. |
| Slice is large | Tasks ordered so chat + unread is shippable before the safety half. |

## Definition of done

Two owners with a mutual match can exchange messages, see an unread count before opening the thread, block the conversation, and report it — with a reviewer able to read a reported thread while the report is open and not after. Privacy policy matches the implemented behaviour. `tsc`, lint, and unit tests green; RLS assertions verified against the live database in rolled-back transactions.
