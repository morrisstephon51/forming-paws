# Forming Paws Slice B — Owner Conversations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two owners with a mutual match can hold a conversation, see unread counts, block it, and report it — with a reviewer able to read a reported thread only while the report is open.

**Architecture:** Messages are keyed to a `matches` row and owned by `owners`, not dogs. All authorization lives in RLS, hanging off one `security definer` helper (`owner_in_match`) so the dogs join exists in exactly one place. Delivery is polling from a client component while the tab is visible; the server component renders the initial thread.

**Tech Stack:** Next.js 15 App Router · React 19 · Supabase (Postgres + RLS) · Tailwind 3 · Vitest · Playwright

**Spec:** `docs/superpowers/specs/2026-08-11-forming-paws-slice-b-chat-design.md`

## Global Constraints

- Supabase project ref: `wyzcnkdonbdykidmcxvx`. Next migration number is **0020**; migrations are immutable once committed.
- **Never** reach a dog or owner name through an embedded PostgREST select on `dogs` or `owners`. Both are owner-gated and return silently-empty rows for the other party. Dog names come from `dogs_browsable` via a batch `.in()` + `Map`, the idiom already used in `app/admin/review-queue/page.tsx:30-33`. Owner names are **never rendered** — participants are identified by their dog.
- Every new `security definer` function must `revoke execute from anon, public` then `grant execute to authenticated`. Migration 0010 exists because this was missed once.
- Messages are immutable: no UPDATE or DELETE policy on `messages`.
- Server actions follow `lib/actions/location.ts`: `'use server'`, `createClient()`, `getUser()`, authorize, mutate, `revalidatePath`.
- Every task ends green: `npx tsc --noEmit` · `npm run lint` · `npm test`.
- Live database assertions run inside `begin; … rollback;` so nothing persists — the pattern used for migration 0019.

---

### Task 1: Migration 0020 — schema, helpers, policies

**Files:**
- Create: `supabase/migrations/0020_owner_conversations.sql`

**Interfaces:**
- Produces: tables `messages`, `match_reads`, `match_blocks`, `match_reports`; enums `report_reason`, `report_status`; functions `owner_in_match(uuid) → boolean`, `match_is_blocked(uuid) → boolean`.
- Consumes: existing `matches`, `owners`, `dogs`, and `is_admin()`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0020_owner_conversations.sql
--
-- Owner-to-owner conversations on a mutual match. A match is between two dogs,
-- but people do the talking, so messages belong to owners.

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

-- security definer so the dogs join is not re-filtered by dogs' own RLS.
-- This is the ONLY place the join lives.
create or replace function public.owner_in_match(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.matches m
    join public.dogs d on d.id in (m.dog_a_id, m.dog_b_id)
    where m.id = p_match_id and d.owner_id = auth.uid()
  );
$$;

-- Either party blocking closes the thread for both.
create or replace function public.match_is_blocked(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.match_blocks b where b.match_id = p_match_id);
$$;

revoke execute on function public.owner_in_match(uuid) from anon, public;
grant execute on function public.owner_in_match(uuid) to authenticated;
revoke execute on function public.match_is_blocked(uuid) from anon, public;
grant execute on function public.match_is_blocked(uuid) to authenticated;

alter table public.messages enable row level security;
alter table public.match_reads enable row level security;
alter table public.match_blocks enable row level security;
alter table public.match_reports enable row level security;

-- Participants always; admins only while a report on this thread is open.
create policy messages_select_participant_or_open_report on public.messages
  for select to authenticated using (
    public.owner_in_match(match_id)
    or (
      public.is_admin()
      and exists (
        select 1 from public.match_reports r
        where r.match_id = messages.match_id
          and r.status in ('open', 'reviewing')
      )
    )
  );

create policy messages_insert_participant on public.messages
  for insert to authenticated with check (
    public.owner_in_match(match_id)
    and sender_owner_id = auth.uid()
    and not public.match_is_blocked(match_id)
  );

create policy match_reads_select_own on public.match_reads
  for select to authenticated using (owner_id = auth.uid());
create policy match_reads_insert_own on public.match_reads
  for insert to authenticated with check (owner_id = auth.uid() and public.owner_in_match(match_id));
create policy match_reads_update_own on public.match_reads
  for update to authenticated using (owner_id = auth.uid());

create policy match_blocks_select_participant on public.match_blocks
  for select to authenticated using (public.owner_in_match(match_id));
create policy match_blocks_insert_own on public.match_blocks
  for insert to authenticated with check (
    blocker_owner_id = auth.uid() and public.owner_in_match(match_id)
  );
create policy match_blocks_delete_own on public.match_blocks
  for delete to authenticated using (blocker_owner_id = auth.uid());

create policy match_reports_select_own_or_admin on public.match_reports
  for select to authenticated using (reporter_owner_id = auth.uid() or public.is_admin());
create policy match_reports_insert_own on public.match_reports
  for insert to authenticated with check (
    reporter_owner_id = auth.uid() and public.owner_in_match(match_id)
  );
create policy match_reports_update_admin on public.match_reports
  for update to authenticated using (public.is_admin());
```

- [ ] **Step 2: Apply it**

Apply with the Supabase MCP `apply_migration`, name `owner_conversations`, using the SQL above.

- [ ] **Step 3: Prove a stranger cannot read someone else's thread**

```sql
begin;
insert into public.messages (match_id, sender_owner_id, body)
select m.id, d.owner_id, 'rls probe'
from public.matches m join public.dogs d on d.id = m.dog_a_id limit 1;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}';
select count(*) as stranger_sees from public.messages;
rollback;
```

Expected: `stranger_sees = 0`.

- [ ] **Step 4: Prove a participant can read it**

```sql
begin;
insert into public.messages (match_id, sender_owner_id, body)
select m.id, d.owner_id, 'rls probe'
from public.matches m join public.dogs d on d.id = m.dog_a_id limit 1;

set local role authenticated;
set local request.jwt.claims = json_build_object(
  'sub', (select d.owner_id::text from public.matches m join public.dogs d on d.id = m.dog_a_id limit 1),
  'role', 'authenticated')::text;
select count(*) as participant_sees from public.messages;
rollback;
```

Expected: `participant_sees = 1`.

- [ ] **Step 5: Prove admin access follows report status**

Use a **real** owner who owns no dogs as the probe admin — 4 such owners exist. Do not invent an `owners` row: `owners.id` is tied to the auth user, and a synthetic id risks a foreign-key failure that would read as a policy pass.

```sql
begin;

-- pick a real owner who is in no match, and make them admin for this txn only
create temp table probe as
select id from public.owners o
where not exists (select 1 from public.dogs d where d.owner_id = o.id)
limit 1;

update public.owners set is_admin = true where id = (select id from probe);

insert into public.messages (match_id, sender_owner_id, body)
select m.id, d.owner_id, 'rls probe'
from public.matches m join public.dogs d on d.id = m.dog_a_id limit 1;

set local role authenticated;
set local request.jwt.claims =
  json_build_object('sub', (select id::text from probe), 'role', 'authenticated')::text;
select count(*) as admin_before_report from public.messages;
reset role;

insert into public.match_reports (match_id, reporter_owner_id, reason)
select m.id, d.owner_id, 'harassment'
from public.matches m join public.dogs d on d.id = m.dog_a_id limit 1;

set local role authenticated;
set local request.jwt.claims =
  json_build_object('sub', (select id::text from probe), 'role', 'authenticated')::text;
select count(*) as admin_with_open_report from public.messages;
reset role;

update public.match_reports set status = 'resolved';

set local role authenticated;
set local request.jwt.claims =
  json_build_object('sub', (select id::text from probe), 'role', 'authenticated')::text;
select count(*) as admin_after_resolved from public.messages;

rollback;
```

If `probe` comes back empty the query silently proves nothing — confirm it selected a row before trusting the counts.

Expected: `admin_before_report = 0`, `admin_with_open_report = 1`, `admin_after_resolved = 0`. **All three must hold** — the middle one alone does not prove access ends.

- [ ] **Step 6: Prove a blocked thread rejects inserts**

```sql
begin;
insert into public.match_blocks (match_id, blocker_owner_id)
select m.id, d.owner_id from public.matches m join public.dogs d on d.id = m.dog_a_id limit 1;

set local role authenticated;
set local request.jwt.claims = json_build_object(
  'sub', (select d.owner_id::text from public.matches m join public.dogs d on d.id = m.dog_a_id limit 1),
  'role', 'authenticated')::text;

insert into public.messages (match_id, sender_owner_id, body)
select m.id, auth.uid(), 'should fail' from public.matches m limit 1;
rollback;
```

Expected: error `new row violates row-level security policy for table "messages"`. An insert that succeeds here is a failed task.

- [ ] **Step 7: Confirm no new advisor findings**

Run the Supabase MCP `get_advisors` with `type: security`. Expected: no findings naming `messages`, `match_reads`, `match_blocks`, or `match_reports`.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0020_owner_conversations.sql
git commit -m "feat(db): owner conversations with report-scoped admin access"
```

---

### Task 2: Unread counting

**Files:**
- Create: `lib/chat/unread.ts`
- Test: `tests/unit/chat-unread.test.ts`

**Interfaces:**
- Produces:
  - `type UnreadMessage = { match_id: string; sender_owner_id: string; created_at: string }`
  - `unreadCount(messages: UnreadMessage[], lastReadAt: string | null, myOwnerId: string): number`
  - `unreadCountsByMatch(messages: UnreadMessage[], lastReadByMatch: Map<string, string>, myOwnerId: string): Map<string, number>`

Pure functions in their own module so a jsdom test can import them without pulling in Server Component machinery — the precedent set by `lib/validators/location.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/chat-unread.test.ts
import { describe, it, expect } from 'vitest'
import { unreadCount, unreadCountsByMatch, type UnreadMessage } from '@/lib/chat/unread'

const ME = 'me-owner-id'
const THEM = 'them-owner-id'

function msg(created_at: string, sender = THEM, match_id = 'm1'): UnreadMessage {
  return { match_id, sender_owner_id: sender, created_at }
}

describe('unreadCount', () => {
  it('counts everything from the other party when never read', () => {
    expect(unreadCount([msg('2026-08-01T10:00:00Z'), msg('2026-08-01T11:00:00Z')], null, ME)).toBe(2)
  })

  it('never counts my own messages', () => {
    expect(unreadCount([msg('2026-08-01T10:00:00Z', ME), msg('2026-08-01T11:00:00Z', ME)], null, ME)).toBe(0)
  })

  it('counts only messages after the last read', () => {
    const messages = [msg('2026-08-01T10:00:00Z'), msg('2026-08-01T12:00:00Z')]
    expect(unreadCount(messages, '2026-08-01T11:00:00Z', ME)).toBe(1)
  })

  it('treats a message exactly at last_read_at as read', () => {
    expect(unreadCount([msg('2026-08-01T11:00:00Z')], '2026-08-01T11:00:00Z', ME)).toBe(0)
  })

  it('returns zero for an empty thread', () => {
    expect(unreadCount([], null, ME)).toBe(0)
  })
})

describe('unreadCountsByMatch', () => {
  it('groups per match and applies each match its own last-read', () => {
    const messages = [
      msg('2026-08-01T10:00:00Z', THEM, 'm1'),
      msg('2026-08-01T12:00:00Z', THEM, 'm1'),
      msg('2026-08-01T10:00:00Z', THEM, 'm2'),
      msg('2026-08-01T10:00:00Z', ME, 'm2'),
    ]
    const reads = new Map([['m1', '2026-08-01T11:00:00Z']])
    const result = unreadCountsByMatch(messages, reads, ME)
    expect(result.get('m1')).toBe(1)
    expect(result.get('m2')).toBe(1)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/chat-unread.test.ts`
Expected: FAIL — cannot resolve `@/lib/chat/unread`.

- [ ] **Step 3: Implement**

```ts
// lib/chat/unread.ts

export type UnreadMessage = {
  match_id: string
  sender_owner_id: string
  created_at: string
}

/**
 * Unread = sent by the other party, after my last read of this thread.
 *
 * A message stamped exactly at last_read_at counts as read: marking a thread
 * read stamps now(), so the message that triggered the read would otherwise
 * stay unread forever.
 *
 * ISO-8601 UTC strings from Postgres compare correctly as strings, so no Date
 * parsing is needed.
 */
export function unreadCount(
  messages: UnreadMessage[],
  lastReadAt: string | null,
  myOwnerId: string
): number {
  return messages.filter(
    (m) => m.sender_owner_id !== myOwnerId && (lastReadAt === null || m.created_at > lastReadAt)
  ).length
}

export function unreadCountsByMatch(
  messages: UnreadMessage[],
  lastReadByMatch: Map<string, string>,
  myOwnerId: string
): Map<string, number> {
  const byMatch = new Map<string, UnreadMessage[]>()
  for (const m of messages) {
    const list = byMatch.get(m.match_id)
    if (list) list.push(m)
    else byMatch.set(m.match_id, [m])
  }

  const counts = new Map<string, number>()
  for (const [matchId, list] of byMatch) {
    counts.set(matchId, unreadCount(list, lastReadByMatch.get(matchId) ?? null, myOwnerId))
  }
  return counts
}
```

- [ ] **Step 4: Run and confirm green**

Run: `npx vitest run tests/unit/chat-unread.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Full gate**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: exit 0 · 0 lint problems · 42 tests (36 existing + 6 new).

- [ ] **Step 6: Commit**

```bash
git add lib/chat/unread.ts tests/unit/chat-unread.test.ts
git commit -m "feat(chat): pure unread-count helpers"
```

---

### Task 3: Thread page and sending

**Files:**
- Create: `app/matches/[id]/page.tsx`, `app/matches/[id]/Thread.tsx`, `app/matches/[id]/actions.ts`

**Interfaces:**
- Consumes: `messages` table; `dogs_browsable`.
- Produces: `sendMessage(matchId: string, body: string): Promise<void>` and `markRead(matchId: string): Promise<void>` from `actions.ts`.

- [ ] **Step 1: Write the server actions**

```ts
// app/matches/[id]/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendMessage(matchId: string, body: string) {
  const trimmed = body.trim()
  if (trimmed.length === 0) throw new Error('Message is empty')
  if (trimmed.length > 2000) throw new Error('Message is too long (2000 characters maximum)')

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')

  // No participant or block check here on purpose: RLS enforces both, so a
  // stale client cannot post into a thread it no longer belongs to.
  const { error } = await supabase
    .from('messages')
    .insert({ match_id: matchId, sender_owner_id: userData.user.id, body: trimmed })

  if (error) throw new Error('Could not send that message. The conversation may have been closed.')
  revalidatePath(`/matches/${matchId}`)
  revalidatePath('/matches')
}

export async function markRead(matchId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')

  const { error } = await supabase
    .from('match_reads')
    .upsert(
      { match_id: matchId, owner_id: userData.user.id, last_read_at: new Date().toISOString() },
      { onConflict: 'match_id,owner_id' }
    )

  if (error) throw error
  revalidatePath('/matches')
  revalidatePath('/dashboard')
}
```

- [ ] **Step 2: Write the thread page**

```tsx
// app/matches/[id]/page.tsx
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Thread from './Thread'
import { markRead } from './actions'

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  // RLS returns nothing unless this owner is in the match, so a miss is a 404.
  const { data: match } = await supabase
    .from('matches')
    .select('id, dog_a_id, dog_b_id, matched_at')
    .eq('id', matchId)
    .maybeSingle()
  if (!match) notFound()

  const { data: myDogs } = await supabase.from('dogs').select('id').eq('owner_id', userData.user.id)
  const myDogIds = new Set((myDogs ?? []).map((d) => d.id))

  // dogs_browsable, never an embedded select through dogs -- dogs is owner-gated
  // and would silently return nothing for the other owner's dog.
  const { data: dogRows } = await supabase
    .from('dogs_browsable')
    .select('id, name')
    .in('id', [match.dog_a_id, match.dog_b_id])
  const nameById = new Map((dogRows ?? []).map((d) => [d.id, d.name]))

  const mineId = myDogIds.has(match.dog_a_id) ? match.dog_a_id : match.dog_b_id
  const theirsId = myDogIds.has(match.dog_a_id) ? match.dog_b_id : match.dog_a_id

  const { data: messages } = await supabase
    .from('messages')
    .select('id, body, sender_owner_id, created_at')
    .eq('match_id', matchId)
    .order('created_at')

  const { data: blocks } = await supabase
    .from('match_blocks')
    .select('blocker_owner_id')
    .eq('match_id', matchId)

  const blockedByMe = (blocks ?? []).some((b) => b.blocker_owner_id === userData.user!.id)
  const blocked = (blocks ?? []).length > 0

  await markRead(matchId)

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {nameById.get(mineId) ?? 'Your dog'} ↔ {nameById.get(theirsId) ?? 'Their dog'}
        </h1>
        <Link href="/matches" className="text-sm text-gray-600 underline">
          All matches
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Meet in a public place. Forming Paws is not a party to any breeding arrangement.
      </p>

      <Thread
        matchId={matchId}
        myOwnerId={userData.user.id}
        theirDogName={nameById.get(theirsId) ?? 'Their dog'}
        initialMessages={messages ?? []}
        blocked={blocked}
        blockedByMe={blockedByMe}
      />
    </main>
  )
}
```

- [ ] **Step 3: Write the client thread**

```tsx
// app/matches/[id]/Thread.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage } from './actions'

export type ThreadMessage = {
  id: string
  body: string
  sender_owner_id: string
  created_at: string
}

export default function Thread({
  matchId,
  myOwnerId,
  theirDogName,
  initialMessages,
  blocked,
  blockedByMe,
}: {
  matchId: string
  myOwnerId: string
  theirDogName: string
  initialMessages: ThreadMessage[]
  blocked: boolean
  blockedByMe: boolean
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  // Cursor lives in a ref, not state: putting it in the effect's dependency
  // array would tear down and rebuild the interval on every new message.
  const cursorRef = useRef<string | null>(initialMessages.at(-1)?.created_at ?? null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      if (document.visibilityState !== 'visible') return
      const supabase = createClient()
      let query = supabase
        .from('messages')
        .select('id, body, sender_owner_id, created_at')
        .eq('match_id', matchId)
        .order('created_at')
      if (cursorRef.current) query = query.gt('created_at', cursorRef.current)

      const { data } = await query
      if (cancelled || !data || data.length === 0) return

      cursorRef.current = data[data.length - 1].created_at
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id))
        return [...prev, ...data.filter((m) => !seen.has(m.id))]
      })
    }

    const timer = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [matchId])

  async function handleSend(formData: FormData) {
    const body = String(formData.get('body') ?? '').trim()
    if (!body) return

    setSending(true)
    setError(null)
    try {
      await sendMessage(matchId, body)
      setDraft('')
      // The cursor is deliberately left where it is, so the next poll picks up
      // the message we just sent along with anything that arrived alongside it.
      // Guessing an id client-side would risk a duplicate when the poll lands.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {messages.map((m) => {
          const mine = m.sender_owner_id === myOwnerId
          return (
            <li
              key={m.id}
              className={`max-w-[80%] rounded-lg border p-3 ${mine ? 'self-end bg-gray-900 text-white' : 'self-start bg-white'}`}
            >
              <p className="text-xs opacity-70">{mine ? 'You' : theirDogName}</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
            </li>
          )
        })}
        {messages.length === 0 && (
          <p className="text-gray-500">No messages yet — say hello.</p>
        )}
      </ul>

      {blocked ? (
        <p className="mt-6 rounded border bg-gray-50 p-4 text-sm text-gray-600">
          {blockedByMe
            ? 'You closed this conversation.'
            : 'This conversation is no longer available.'}
        </p>
      ) : (
        <form action={handleSend} className="mt-6 flex gap-2">
          <input
            name="body"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder={`Message ${theirDogName}'s owner`}
            className="flex-1 rounded border p-2"
          />
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0}
            className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </>
  )
}
```

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: exit 0 · 0 lint problems · 42 tests · build compiles with `/matches/[id]` in the route table.

- [ ] **Step 5: Commit**

```bash
git add app/matches
git commit -m "feat(chat): thread page with polling and send"
```

---

### Task 4: Matches list with unread badges

**Files:**
- Modify: `app/matches/page.tsx`

**Interfaces:**
- Consumes: `unreadCountsByMatch` from `@/lib/chat/unread`.

- [ ] **Step 1: Replace the list body**

Replace the whole file with:

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { unreadCountsByMatch } from '@/lib/chat/unread'

export default async function MatchesPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: myDogs } = await supabase.from('dogs').select('id').eq('owner_id', userData.user.id)
  const myDogIds = new Set((myDogs ?? []).map((d) => d.id))

  const { data: matches } = await supabase
    .from('matches')
    .select('id, matched_at, dog_a_id, dog_b_id')
    .order('matched_at', { ascending: false })

  const involvedDogIds = Array.from(
    new Set((matches ?? []).flatMap((m) => [m.dog_a_id, m.dog_b_id]))
  )
  const { data: dogRows } = involvedDogIds.length
    ? await supabase.from('dogs_browsable').select('id, name').in('id', involvedDogIds)
    : { data: [] }
  const nameById = new Map((dogRows ?? []).map((d) => [d.id, d.name]))

  // RLS limits both queries to this owner's threads, so no match_id filter is
  // needed. Fine at current scale; if thread volume grows this becomes an RPC.
  const { data: messages } = await supabase
    .from('messages')
    .select('match_id, sender_owner_id, created_at, body')
    .order('created_at')
  const { data: reads } = await supabase.from('match_reads').select('match_id, last_read_at')

  const lastReadByMatch = new Map((reads ?? []).map((r) => [r.match_id, r.last_read_at]))
  const unread = unreadCountsByMatch(messages ?? [], lastReadByMatch, userData.user.id)

  const lastByMatch = new Map<string, string>()
  for (const m of messages ?? []) lastByMatch.set(m.match_id, m.body)

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your matches</h1>
        <Link href="/dashboard" className="text-sm text-gray-600 underline">
          Back to dashboard
        </Link>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        Matches are introductions only — Forming Paws is not a party to any breeding arrangement.
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {matches?.map((m) => {
          const mineId = myDogIds.has(m.dog_a_id) ? m.dog_a_id : m.dog_b_id
          const theirsId = myDogIds.has(m.dog_a_id) ? m.dog_b_id : m.dog_a_id
          const count = unread.get(m.id) ?? 0
          const preview = lastByMatch.get(m.id)
          return (
            <li key={m.id}>
              <Link href={`/matches/${m.id}`} className="block rounded border p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">
                    {nameById.get(mineId) ?? 'Your dog'} ↔ {nameById.get(theirsId) ?? 'Their dog'}
                  </p>
                  {count > 0 && (
                    <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-bold text-white">
                      {count}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-gray-500">
                  {preview ?? `Matched ${new Date(m.matched_at).toLocaleDateString()}`}
                </p>
              </Link>
            </li>
          )
        })}
        {matches?.length === 0 && <p className="text-gray-500">No matches yet.</p>}
      </ul>
    </main>
  )
}
```

Note the removed sentence: the old copy said "Chat is coming in a later slice." It is not.

- [ ] **Step 2: Gate**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: exit 0 · 0 lint problems · 42 tests.

- [ ] **Step 3: Put a total unread count on the dashboard**

The matches page is not where members land. In `app/dashboard/page.tsx`, add the import:

```tsx
import { unreadCountsByMatch } from '@/lib/chat/unread'
```

after the existing `dogs` query, add:

```tsx
  // RLS scopes both to this owner's threads.
  const { data: chatMessages } = await supabase
    .from('messages')
    .select('match_id, sender_owner_id, created_at')
  const { data: chatReads } = await supabase.from('match_reads').select('match_id, last_read_at')

  const totalUnread = Array.from(
    unreadCountsByMatch(
      chatMessages ?? [],
      new Map((chatReads ?? []).map((r) => [r.match_id, r.last_read_at])),
      userData.user.id
    ).values()
  ).reduce((sum, n) => sum + n, 0)
```

and replace the existing Matches link with:

```tsx
          <Link href="/matches" className="text-sm underline text-gray-600">
            Matches
            {totalUnread > 0 && (
              <span className="ml-1 rounded-full bg-gray-900 px-1.5 py-0.5 text-xs font-bold text-white no-underline">
                {totalUnread}
              </span>
            )}
          </Link>
```

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app/matches/page.tsx app/dashboard/page.tsx
git commit -m "feat(chat): unread badges on the matches list and dashboard"
```

---

### Task 5: Block and unblock

**Files:**
- Modify: `app/matches/[id]/actions.ts`, `app/matches/[id]/Thread.tsx`

**Interfaces:**
- Produces: `blockMatch(matchId: string): Promise<void>`, `unblockMatch(matchId: string): Promise<void>`.

- [ ] **Step 1: Add the actions**

Append to `app/matches/[id]/actions.ts`:

```ts
export async function blockMatch(matchId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')

  const { error } = await supabase
    .from('match_blocks')
    .upsert(
      { match_id: matchId, blocker_owner_id: userData.user.id },
      { onConflict: 'match_id,blocker_owner_id' }
    )

  if (error) throw error
  revalidatePath(`/matches/${matchId}`)
  revalidatePath('/matches')
}

export async function unblockMatch(matchId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')

  // Only removes MY block. If the other party also blocked, the thread stays
  // closed -- which is correct.
  const { error } = await supabase
    .from('match_blocks')
    .delete()
    .eq('match_id', matchId)
    .eq('blocker_owner_id', userData.user.id)

  if (error) throw error
  revalidatePath(`/matches/${matchId}`)
  revalidatePath('/matches')
}
```

- [ ] **Step 2: Wire the controls into `Thread.tsx`**

Add to the imports:

```tsx
import { sendMessage, blockMatch, unblockMatch } from './actions'
```

Replace the `blocked ?` branch with:

```tsx
      {blocked ? (
        <div className="mt-6 rounded border bg-gray-50 p-4 text-sm text-gray-600">
          <p>
            {blockedByMe
              ? 'You closed this conversation.'
              : 'This conversation is no longer available.'}
          </p>
          {blockedByMe && (
            <form action={async () => { await unblockMatch(matchId) }} className="mt-3">
              <button type="submit" className="rounded border px-3 py-1.5 text-gray-900">
                Reopen conversation
              </button>
            </form>
          )}
        </div>
      ) : (
        <>
          <form action={handleSend} className="mt-6 flex gap-2">
            <input
              name="body"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              placeholder={`Message ${theirDogName}'s owner`}
              className="flex-1 rounded border p-2"
            />
            <button
              type="submit"
              disabled={sending || draft.trim().length === 0}
              className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>
          <form
            action={async () => { await blockMatch(matchId) }}
            className="mt-4 border-t pt-4"
          >
            <button type="submit" className="text-sm text-gray-600 underline">
              Close this conversation
            </button>
          </form>
        </>
      )}
```

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 4: Verify the block actually bites**

Start the app (`npm run dev`), sign in as `E2E_FIXTURE_EMAIL`, open a thread, send a message, click **Close this conversation**. Expected: composer disappears, "You closed this conversation" appears, and **Reopen conversation** restores it.

- [ ] **Step 5: Commit**

```bash
git add app/matches
git commit -m "feat(chat): close and reopen a conversation"
```

---

### Task 6: Reporting and the admin queue

**Files:**
- Create: `app/matches/[id]/ReportForm.tsx`, `app/admin/reports/page.tsx`, `app/admin/reports/actions.ts`
- Modify: `app/matches/[id]/actions.ts`, `app/matches/[id]/page.tsx`

**Interfaces:**
- Produces: `reportMatch(matchId: string, reason: string, detail: string): Promise<void>`; `setReportStatus(reportId: string, status: string, notes: string): Promise<void>`.

- [ ] **Step 1: Add the report action**

Append to `app/matches/[id]/actions.ts`:

```ts
const REPORT_REASONS = new Set([
  'harassment',
  'spam',
  'animal_welfare',
  'suspected_fake_documents',
  'other',
])

export async function reportMatch(matchId: string, reason: string, detail: string) {
  if (!REPORT_REASONS.has(reason)) throw new Error('Pick a reason')
  const trimmed = detail.trim()
  if (trimmed.length > 1000) throw new Error('Please keep the detail under 1000 characters')

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')

  const { error } = await supabase.from('match_reports').insert({
    match_id: matchId,
    reporter_owner_id: userData.user.id,
    reason,
    detail: trimmed || null,
  })

  if (error) throw error
  revalidatePath(`/matches/${matchId}`)
}
```

- [ ] **Step 2: Write the report form**

```tsx
// app/matches/[id]/ReportForm.tsx
'use client'

import { useState } from 'react'
import { reportMatch } from './actions'

const REASONS: [string, string][] = [
  ['harassment', 'Harassment or abusive messages'],
  ['animal_welfare', 'Animal welfare concern'],
  ['suspected_fake_documents', 'Suspected fake health documents'],
  ['spam', 'Spam or advertising'],
  ['other', 'Something else'],
]

export default function ReportForm({ matchId }: { matchId: string }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (done) {
    return (
      <p className="mt-4 border-t pt-4 text-sm text-green-700">
        Thank you — a reviewer will read this conversation and follow up.
      </p>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 border-t pt-4 text-sm text-gray-600 underline"
      >
        Report this conversation
      </button>
    )
  }

  return (
    <form
      action={async (formData: FormData) => {
        setError(null)
        try {
          await reportMatch(
            matchId,
            String(formData.get('reason')),
            String(formData.get('detail') ?? '')
          )
          setDone(true)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not send that report.')
        }
      }}
      className="mt-4 flex flex-col gap-3 border-t pt-4"
    >
      <p className="text-sm text-gray-600">
        Reporting lets a Forming Paws reviewer read this conversation while they look into it.
      </p>
      <select name="reason" required className="rounded border p-2 text-sm">
        <option value="">Choose a reason…</option>
        {REASONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <textarea
        name="detail"
        maxLength={1000}
        placeholder="Anything else we should know (optional)"
        className="rounded border p-2 text-sm"
      />
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
          Send report
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-600 underline">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
```

- [ ] **Step 3: Mount it on the thread page**

In `app/matches/[id]/page.tsx`, add the import:

```tsx
import ReportForm from './ReportForm'
```

and place it directly after the `<Thread ... />` element:

```tsx
      <ReportForm matchId={matchId} />
```

- [ ] **Step 4: Write the admin action**

```ts
// app/admin/reports/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const STATUSES = new Set(['open', 'reviewing', 'resolved', 'dismissed'])

export async function setReportStatus(reportId: string, status: string, notes: string) {
  if (!STATUSES.has(status)) throw new Error('Invalid status')

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Unauthorized')

  const { data: owner } = await supabase
    .from('owners')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single()
  if (!owner?.is_admin) throw new Error('Forbidden')

  const { error } = await supabase
    .from('match_reports')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes || null,
    })
    .eq('id', reportId)

  if (error) throw error
  revalidatePath('/admin/reports')
}
```

- [ ] **Step 5: Write the admin queue**

```tsx
// app/admin/reports/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { setReportStatus } from './actions'

const REASON_LABELS: Record<string, string> = {
  harassment: 'Harassment',
  animal_welfare: 'Animal welfare',
  suspected_fake_documents: 'Suspected fake documents',
  spam: 'Spam',
  other: 'Other',
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: owner } = await supabase
    .from('owners')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single()
  if (!owner?.is_admin) redirect('/dashboard')

  const { data: reports } = await supabase
    .from('match_reports')
    .select('id, match_id, reason, detail, status, created_at')
    .in('status', ['open', 'reviewing'])
    .order('created_at')

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Reported conversations</h1>
      <p className="mt-2 text-sm text-gray-500">
        You can read a reported conversation while its report is open or being reviewed. Resolving or
        dismissing it ends that access.
      </p>
      <ul className="mt-6 flex flex-col gap-4">
        {reports?.map((r) => (
          <li key={r.id} className="rounded border p-4">
            <p className="font-medium">{REASON_LABELS[r.reason] ?? r.reason}</p>
            {r.detail && <p className="mt-1 text-sm text-gray-600">{r.detail}</p>}
            <p className="mt-1 text-xs text-gray-500">
              Reported {new Date(r.created_at).toLocaleDateString()} · status {r.status}
            </p>
            <Link href={`/matches/${r.match_id}`} className="mt-2 inline-block text-sm underline">
              Read the conversation
            </Link>
            <form
              action={async (formData: FormData) => {
                'use server'
                await setReportStatus(
                  r.id,
                  String(formData.get('status')),
                  String(formData.get('notes') ?? '')
                )
              }}
              className="mt-3 flex flex-wrap items-center gap-2"
            >
              <select name="status" defaultValue="reviewing" className="rounded border p-1.5 text-sm">
                <option value="reviewing">Reviewing</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
              <input
                name="notes"
                placeholder="Reviewer notes"
                className="flex-1 rounded border p-1.5 text-sm"
              />
              <button type="submit" className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white">
                Save
              </button>
            </form>
          </li>
        ))}
        {reports?.length === 0 && <p className="text-gray-500">Nothing reported. 🎉</p>}
      </ul>
    </main>
  )
}
```

**Note:** an admin who is not a participant will see the thread page render dog names as fallbacks, because `dogs_browsable` is readable but their own dog set does not include either dog. That is cosmetic and acceptable — the messages, which is what they are there for, are readable via the report policy.

- [ ] **Step 6: Gate**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all green, `/admin/reports` in the route table.

- [ ] **Step 7: Commit**

```bash
git add app/matches app/admin/reports
git commit -m "feat(safety): report a conversation and an admin review queue"
```

---

### Task 7: Privacy policy and terms

**Files:**
- Modify: `app/privacy/page.tsx`, `app/terms/page.tsx`, `lib/site.ts`

**This task is not optional.** The live privacy policy currently says nothing about messages. Shipping Tasks 1–6 without it leaves a published policy that does not describe what the product does.

- [ ] **Step 1: Bump the legal date**

In `lib/site.ts`, change:

```ts
export const LEGAL_LAST_UPDATED = '11 August 2026'
```

to the date the change ships, in the same `D MMMM YYYY` format.

- [ ] **Step 2: Add the messages section to the privacy policy**

In `app/privacy/page.tsx`, inside the "What we collect" list, add:

```tsx
            <li>
              <strong>Messages</strong> you send to another owner after a mutual match.
            </li>
```

Then add this section immediately after the "Who can see what" section:

```tsx
        <section>
          <h2 className="text-xl font-bold text-gray-900">Your messages</h2>
          <p className="mt-3">
            Messages between two owners are private to those two people. Our staff{' '}
            <strong>cannot</strong> read them.
          </p>
          <p className="mt-3">
            There is one exception. If either owner reports a conversation, a reviewer can read that
            conversation while they look into the report, so that we can act on harassment, welfare
            concerns, or falsified documents. <strong>That access ends</strong> when the report is
            resolved or dismissed.
          </p>
          <p className="mt-3">
            Messages cannot be edited or deleted individually — that is deliberate, so a reported
            conversation cannot be altered afterwards. All of your messages are removed when your
            account is deleted.
          </p>
        </section>
```

- [ ] **Step 3: Add the conduct line to the terms**

In `app/terms/page.tsx`, inside the "Your responsibilities" list, add:

```tsx
            <li>
              Keep messages civil. Reporting a conversation lets a reviewer read it while they look
              into the report.
            </li>
```

- [ ] **Step 4: Verify the pages still render**

Run: `npm run build && npm run start`, then in another shell:

```bash
curl -s http://localhost:3000/privacy | grep -c "Your messages"
curl -s http://localhost:3000/terms | grep -c "Keep messages civil"
```

Expected: `1` from each. Then stop the server with `lsof -ti:3000 | xargs kill` — `pkill -f "next start"` leaves the `next-server` child alive and it will serve stale routes.

- [ ] **Step 5: Gate**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add app/privacy/page.tsx app/terms/page.tsx lib/site.ts
git commit -m "docs(legal): describe message privacy and the report exception"
```

---

### Task 8: End-to-end conversation test

**Files:**
- Create: `tests/e2e/conversation-flow.spec.ts`

Runs locally only. CI has no Supabase fixture credentials, which is why `ci.yml` excludes Playwright.

**Precondition:** the two fixture owners in `.env.local` must already have a mutual match. `tests/e2e/browse-and-match-flow.spec.ts` creates one; if this test finds no match it must fail loudly rather than skip, or it would pass while testing nothing.

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/conversation-flow.spec.ts
import { test, expect } from '@playwright/test'

const A = { email: process.env.E2E_FIXTURE_EMAIL!, password: process.env.E2E_FIXTURE_PASSWORD! }
const B = { email: process.env.E2E_FIXTURE_B_EMAIL!, password: process.env.E2E_FIXTURE_B_PASSWORD! }

async function signIn(page: import('@playwright/test').Page, who: { email: string; password: string }) {
  await page.goto('/login')
  await page.fill('input[name="email"]', who.email)
  await page.fill('input[name="password"]', who.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')
}

test('an owner can message a match and the other owner sees it', async ({ browser }) => {
  const body = `e2e hello ${Date.now()}`

  const ctxA = await browser.newContext()
  const pageA = await ctxA.newPage()
  await signIn(pageA, A)
  await pageA.goto('/matches')

  const firstMatch = pageA.locator('a[href^="/matches/"]').first()
  await expect(firstMatch, 'fixture owners must already share a match').toBeVisible()
  await firstMatch.click()
  await pageA.waitForURL('**/matches/**')

  await pageA.fill('input[name="body"]', body)
  await pageA.click('button[type="submit"]')
  await expect(pageA.getByText(body)).toBeVisible({ timeout: 10_000 })

  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  await signIn(pageB, B)
  await pageB.goto('/matches')
  await pageB.locator('a[href^="/matches/"]').first().click()
  await expect(pageB.getByText(body)).toBeVisible({ timeout: 10_000 })

  await ctxA.close()
  await ctxB.close()
})

test('closing a conversation hides the composer for both owners', async ({ browser }) => {
  const ctxA = await browser.newContext()
  const pageA = await ctxA.newPage()
  await signIn(pageA, A)
  await pageA.goto('/matches')
  await pageA.locator('a[href^="/matches/"]').first().click()

  await pageA.getByRole('button', { name: 'Close this conversation' }).click()
  await expect(pageA.getByText('You closed this conversation.')).toBeVisible()
  await expect(pageA.locator('input[name="body"]')).toHaveCount(0)

  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  await signIn(pageB, B)
  await pageB.goto('/matches')
  await pageB.locator('a[href^="/matches/"]').first().click()
  await expect(pageB.getByText('This conversation is no longer available.')).toBeVisible()
  await expect(pageB.locator('input[name="body"]')).toHaveCount(0)

  // Leave the fixtures usable for the next run.
  await pageA.getByRole('button', { name: 'Reopen conversation' }).click()
  await expect(pageA.locator('input[name="body"]')).toBeVisible()

  await ctxA.close()
  await ctxB.close()
})
```

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -- conversation-flow`
Expected: 2 passed. A failure on the first assertion means the fixtures share no match — run `browse-and-match-flow` first.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/conversation-flow.spec.ts
git commit -m "test(e2e): conversation send, receive, close and reopen"
```

---

## Shippable midpoint

Tasks 1–4 deliver working conversations with unread badges. If you want members using it before the safety half is finished, that is a coherent place to stop — but the landing page's "report tools" promise stays unmet until Task 6, and the privacy policy stays inaccurate until Task 7. Do not ship Tasks 1–6 without Task 7.

## Definition of done

Two owners with a mutual match can exchange messages, see unread counts before opening a thread, close and reopen a conversation, and report it. A reviewer can read a reported conversation while the report is open and not after — proven by the three-way assertion in Task 1 Step 5. The privacy policy describes this behaviour. `tsc`, lint, and unit tests green.
