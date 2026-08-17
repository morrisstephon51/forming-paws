# Brand system, member home, and account settings — design

Date: 2026-08-17
Status: approved (pending user review of this document)

## Problem

Three gaps, one root cause.

1. **The brand exists but nothing uses it.** Commit `3a005a6` (2026-08-15) added the
   palette (`brand` `#2F6B5C`, `accent` `#E8734A`, `ivory`, `ink`), the display/body
   font pairing (Fraunces/Nunito), and `public/logo.svg`. Every page still renders in
   `bg-gray-900` and `text-gray-600`. The landing page still uses a 🐾 emoji where the
   logo belongs.
2. **There is no signed-in home.** `/dashboard` is an 86-line list of dogs. A member
   with an unread message, a pending interest, and an unverified dog has no single
   screen that tells them what to do next.
3. **There is no settings page.** Password lives at `/account/password`, location is
   embedded in the dashboard, display name cannot be changed after signup, email cannot
   be changed at all, and **the app has no sign-out button anywhere**.

The root cause of (1) is that there is nothing to swap *to*. Rebranding fifteen pages
one at a time is fifteen redesigns. A shared component layer turns it into a class swap.

## Decisions

Locked with Stefan on 2026-08-17:

| Question | Decision |
|---|---|
| Landing page | Rebrand the existing page; keep content and structure |
| Member home | New route at `/home`; `/dashboard` redirects to it |
| Settings scope | Profile + location, password + email, notifications, sign out + delete |
| Account deletion | Deactivate immediately, hard-purge after 30 days |
| Paw | Keep both — `logo.svg` as the mark, 🐾 as a playful accent |
| Header/nav | One shared component across the whole app |
| Brand coverage | All pages, not just the two being built |
| Sequencing | Three increments, three PRs |
| Notification toggles | Ship them, labelled honestly — nothing sends email yet |

## Decomposition

Three increments. Each is independently shippable and independently revertible.

| # | Scope | Touches DB |
|---|---|---|
| 1 | Brand component layer, `Logo`, `SiteHeader`, landing rebrand | No |
| 2 | Member home at `/home`, brand applied to remaining pages | No |
| 3 | `/settings`, deactivation, reactivation, scheduled purge | Yes |

Increment 3 is the only one that can break authentication or data access. Keeping it
last means increments 1 and 2 are live and stable before any RLS policy changes.

---

# Increment 1 — Brand system and landing rebrand

## Component layer

Semantic classes in `app/globals.css` under `@layer components`. These are the
vocabulary the rest of the app rebrands *into*:

| Class | Purpose |
|---|---|
| `.fp-btn` | Primary action — brand green fill, ivory text |
| `.fp-btn-accent` | Terracotta, reserved for health/verification actions |
| `.fp-btn-ghost` | Outlined secondary |
| `.fp-card` | Bordered content block |
| `.fp-band` | Full-width ivory section background |
| `.fp-link` | Underlined inline link at brand green |
| `.fp-badge` | Small pill — verification status, unread counts |

Rationale: a page rebrands by swapping `className="rounded bg-gray-900 px-4 py-2
text-white"` for `className="fp-btn"`. That is a mechanical, reviewable diff. Tailwind
utilities stay available for layout; only the *visual identity* is centralised.

## `components/Logo.tsx`

Renders `public/logo.svg` inline at a caller-specified size, with an optional wordmark.
Inline rather than `<Image>` so it inherits `currentColor` where useful and adds no
network request. Props: `size` (`sm` | `md` | `lg`), `withWordmark` (boolean).

## `components/SiteHeader.tsx`

One component, two variants, selected by a `variant` prop rather than by sniffing the
session — pages already know which context they are in, and passing it explicitly keeps
the component a pure function of its props and therefore unit-testable.

- **`variant="public"`** — logo + wordmark, anchors (`#how`, `#health`, `#roadmap`,
  `#faq`), and a Join CTA. Used by `/`, `/app`, `/faq`, `/contact`, `/privacy`,
  `/terms`.
- **`variant="member"`** — logo + wordmark, links to Home / Browse / Matches /
  Settings, an unread badge on Matches, and the signed-in member's display name.

The unread count is passed in as a prop. `SiteHeader` does no data fetching; the page
that renders it already has a Supabase client and, in most cases, already computes the
count.

Nav link definitions live in `lib/nav.ts` as plain data so the link set can be unit
tested without rendering React.

## Landing rebrand

`app/page.tsx` keeps its DOM structure, copy, section ids, and anchor targets. The
`#how`, `#health`, `#roadmap`, `#faq`, `#signin`, and `#waitlist` ids are all preserved —
they are linked from `SiteFooter`, from `StickyJoinBar`, and from indexed URLs.

Changes:

- Inline `<header>` replaced by `<SiteHeader variant="public" />`
- `bg-gray-50` section backgrounds become `.fp-band` (ivory)
- `bg-gray-900` buttons become `.fp-btn`
- Health/verification cards use terracotta accents; the 🐾 emoji stays as a section
  accent in the how-it-works and health headings
- `text-gray-600` body copy becomes `text-ink-soft`

`SiteFooter` is rebranded in the same pass since every public page renders it.

## Testing

- Unit: `lib/nav.ts` returns the expected link set per variant, and marks the active
  route correctly.
- Unit: `SiteHeader` renders the unread badge only when the count is above zero, and
  renders the count as text (not a bare dot) so screen readers announce it.
- Visual: `next build` clean, `tsc` clean, and a manual pass of `/` at 375px and 1280px.

---

# Increment 2 — Member home

## Route

New route at `app/home/page.tsx`. Two redirect changes:

- `app/dashboard/page.tsx` is deleted and replaced by a redirect to `/home`, declared in
  `next.config.ts` (`permanent: false`, matching the cutover convention already used
  there). Its two helpers move rather than die: `app/dashboard/dogLabel.ts` becomes
  `lib/dogs/dogLabel.ts` (the home page needs it, and `tests/unit/dashboard-verification.test.ts`
already covers it — that test's import path moves with the file), and
  `app/dashboard/LocationSettings.tsx` moves to the settings page in Increment 3. Until
  then it renders on `/home`, so location control is never unreachable between
  increments.
- `next.config.ts:34` changes `/home.html` → `/dashboard` into `/home.html` → `/home`,
  so the URL printed on flyers lands on the real page rather than taking two hops.

Every in-app link to `/dashboard` is updated: `app/page.tsx` (two), `app/matches/[id]`,
the auth flows, and `app/account/password`. The redirect is a safety net for external
links, not a substitute for fixing internal ones.

## Contents

A server component rendering, in priority order:

1. **Next action** — one prompt, chosen by the first unmet condition: no dogs → "Add
   your dog"; a dog without verified health docs → "Upload health records for {name}";
   no location set → "Set your location to see dogs near you"; otherwise → "Browse dogs
   near you".
2. **Unread messages** — count and a link to `/matches`, only when above zero.
3. **Your dogs** — each with name, breed, and verification badge, as today.
4. **Recent activity** — the most recent matches.

The next-action selection is a pure function in `lib/home/nextAction.ts` taking a
plain summary object and returning a discriminated union. All branch selection is unit
tested there; the page only renders the result.

## Data access

The page reads `dogs` (owner-scoped, safe), calls `dog_is_baseline_verified` per dog as
`/dashboard` does today, and reuses `threadSummaries` / `totalUnread` from
`lib/chat/threads.ts`.

**Constraint carried from prior incidents:** any query that resolves a dog belonging to
another owner must go through `dogs_browsable`, never an embedded select through `dogs`.
The recent-matches section is the one place on this page that touches other owners' dogs,
so it follows the pattern already established in `app/matches/page.tsx:33`.

## Brand pass over remaining pages

Mechanical swap to the Increment 1 vocabulary across `/browse`, `/matches`,
`/matches/[id]`, `/dogs/[id]`, `/dogs/new`, `/login`, `/signup`, `/thank-you`,
`/contact`, `/faq`, `/app`, `/privacy`, `/terms`, `/not-found`, and the three `/admin`
pages. `SiteHeader` is adopted on each. No behaviour changes in this pass — if a diff
in this step changes anything other than presentation, it belongs in a different commit.

---

# Increment 3 — Settings, deactivation, and purge

## Route and sections

`app/settings/page.tsx`, four sections:

1. **Profile** — display name (`owners.display_name`, currently write-once at signup)
   and the location controls lifted out of `app/dashboard/LocationSettings.tsx`.
2. **Account** — email address and a link to `/account/password`.
3. **Notifications** — three toggles, labelled.
4. **Danger zone** — sign out, delete account.

`/account/password` remains a standalone route. Password-recovery emails redirect there
directly and that flow must not be disturbed; settings links to it rather than absorbing
it.

## Sign out

A server action calling `supabase.auth.signOut()` then redirecting to `/`. Rendered in
the danger zone and in the `SiteHeader` member variant — a member should never have to
find a settings page to log out.

## Email change

`supabase.auth.updateUser({ email })`. Supabase's secure-email-change default sends a
confirmation to **both** the old and new addresses, and the change lands only when both
are confirmed. Implications:

- The UI must say the change is pending until confirmed, not report success.
- `/auth/confirm` already handles `token_hash`; it needs to accept `type=email_change`
  and route to `/settings` with a confirmation notice.
- Requires no new redirect-URL allow-list entry — `https://theplugai.xyz/**` already
  covers `/auth/confirm`.

## Migration `0022_owner_settings_and_deactivation.sql`

```sql
alter table public.owners
  add column deactivated_at timestamptz,
  add column notify_matches boolean not null default true,
  add column notify_messages boolean not null default true,
  add column notify_health_reviews boolean not null default true;
```

`owners_update_own` already permits an owner to update their own row, so the preference
columns need no new policy. `deactivated_at` must **not** be freely writable by the
owner — a member setting it to `null` by direct REST call would silently cancel a
pending deletion, and setting it to a past date would fast-track a purge past the
report check. It is written only by `security definer` functions:

- `public.deactivate_own_account()` — sets `deactivated_at = now()` for `auth.uid()`.
- `public.reactivate_own_account()` — clears it for `auth.uid()`.

Enforced with **column-level privileges**, not an RLS policy:

```sql
revoke update on public.owners from authenticated;
grant update (display_name, location_label, location_point,
              notify_matches, notify_messages, notify_health_reviews)
  on public.owners to authenticated;
```

RLS still applies on top, so `owners_update_own` continues to confine a member to their
own row; the column grant confines *which columns* of that row.

An RLS policy cannot express this constraint. A policy's `USING` clause sees the old
row and `WITH CHECK` sees the new row, but neither can reference both, so "`deactivated_at`
is unchanged" is not expressible as a policy predicate. The alternative — a `before
update` trigger comparing `OLD` and `NEW` — would work, but column privileges are
declarative, are visible in `\dp`, and fail closed at the grant layer before any row is
touched.

## Which read surfaces get the deactivation filter

This is the part with the highest risk of reintroducing a known bug, so each surface is
decided explicitly rather than by a blanket rule.

| Surface | Filtered? | Why |
|---|---|---|
| `browse_dogs()` | **Yes** | The discovery feed. A deactivated owner's dogs must not appear. It already joins `owners o`; the change is `and o.deactivated_at is null`. |
| `dogs_browsable` | **No** | This view is *not* only the browse feed. `app/matches/page.tsx:33`, `app/matches/[id]/page.tsx:38`, and `app/admin/review-queue/page.tsx:39` use it to resolve dog **names**. Filtering it would blank the dog's name in every existing conversation and in the admin queue — the exact "embedded select silently filtered by another table's access" failure this repo has hit four times. |
| `/dogs/[id]` | **Yes**, explicitly | A direct URL to a deactivated owner's dog should 404 for anyone who is not that dog's owner. Because `dogs_browsable` is deliberately unfiltered, this page needs its own check on the owner's `deactivated_at` at `app/dogs/[id]/page.tsx:42`. |
| Existing matches and threads | **No** | A conversation that already exists stays readable, with the other party marked inactive in the UI. Silently emptying a thread would look like data loss to the remaining participant. |
| Dog photos | Follows `dogs_browsable` | Migration 0019 couples photo visibility to that view. Since the view stays unfiltered, photos remain resolvable in existing threads and remain absent from browse (because `browse_dogs()` excludes them). This is the intended outcome and requires no change to 0019. |

## Reactivation

A deactivated owner can still authenticate — Supabase auth is untouched by
deactivation. `app/account/reactivate/page.tsx` is where they land: a page offering
"Restore my account" (calls `reactivate_own_account()`) or "Delete now".

Routing: `/home`, `/browse`, `/matches`, and `/settings` each check `deactivated_at` and
redirect to `/account/reactivate` when it is set. This is a per-page check rather than
middleware, because `middleware.ts` currently performs no database reads and adding one
would put a query on the hot path of every request including static assets.

## Purge

A `pg_cron` job, defined in the migration so the schedule is version-controlled rather
than living invisibly in the dashboard. Runs daily, and hard-deletes from `auth.users`
(which cascades to `owners` and everything below) where:

- `deactivated_at < now() - interval '30 days'`, **and**
- the owner does not own either dog in a match that is named by a `match_reports` row
  with status `open` or `reviewing`.

The second condition covers both parties, not just the reported one. If the *reporter*
purges, their side of the conversation cascades away and the admin is left reviewing a
one-sided thread — evidence damaged just as surely.

The second condition is the point of the whole design. Without it, a member reported for
harassment could delete their account and cascade-erase the messages that constitute the
evidence, because `messages.sender_owner_id` is declared
`on delete cascade` (`0020_owner_conversations.sql:16`).

Owners skipped for this reason stay deactivated indefinitely and are surfaced in the
admin reports queue so a human resolves the report before the purge can proceed.

If `pg_cron` proves unavailable on the project's plan at implementation time, the
fallback is a Vercel Cron route guarded by a shared secret. The eligibility logic lives
in a SQL function either way, so the scheduler is swappable without touching the rules.

## Notification toggles

The three columns store real preferences. Nothing in the app sends email today, so the
section carries a plain line saying so:

> Email notifications aren't sending yet. We'll use these settings the moment they are.

This is a deliberate product decision, not an oversight: collecting the preference now
means the first notification send honours it, and stating the current state means no
member believes they have switched off something that was never on.

## Testing

- **Unit** — settings form validators (display name length, email shape); the
  next-action selector; the purge-eligibility predicate expressed as a pure function
  mirroring the SQL.
- **RLS** — assertions inside `begin; … rollback;` so nothing persists:
  - an owner cannot write `deactivated_at` directly;
  - `browse_dogs()` returns a deactivated owner's dog before deactivation and not after
    (asserted in all three states — visible, hidden, visible again — because the middle
    value alone does not prove the filter is what changed);
  - `dogs_browsable` still returns the name after deactivation, guarding the
    thread-name regression described above.
- **E2E** — change display name and see it persist; deactivate and confirm the dog
  leaves `/browse`; sign in again and land on `/account/reactivate`; restore and confirm
  the dog returns.

## Out of scope

- Actually sending notification emails.
- Data export / "download my data".
- Changing how `messages` immutability works.
- Two-factor authentication.
