# Puppy marketplace — design

Date: 2026-09-03
Status: draft (planning only — no implementation in this pass)

## Why this is a plan, not a build

Stefan asked to "build the puppy marketplace, or at least plan for it." This
document is the second thing, deliberately. A marketplace that lists and sells
live animals is a materially different risk category from the adult-dog
matching this app already does, and this repo has already made one real
decision here that this plan builds on rather than reopens:

> **2026-08-26, Status Log / Admin Console Build Log:** "Selling puppies is
> deferred, deliberately. No payment library is installed, live-animal sales
> are a restricted category for most processors, and Illinois PA 102-0227
> constrains retail pet sales. Scoped to listings-with-inquiries first, no
> checkout."

Nothing below contradicts that. It's the same scope, worked out in enough
detail to actually build from next.

## The legal landscape (flagged, not resolved)

None of this is legal advice, and none of it should ship without a real
lawyer reading it. It's flagged here so the plan doesn't quietly assume it
away.

1. **Illinois PA 102-0227** restricts retail sale of dogs, cats, and rabbits
   by pet shops unless the animals come from a shelter or rescue. It targets
   the puppy-mill-to-pet-store pipeline specifically. Forming Paws is not a
   pet shop and doesn't take custody of animals, but a marketplace that lists
   commercially-bred puppies for sale is close enough to the thing this law
   regulates that "are we a pet shop under this statute" needs an actual
   answer before launch, not an assumption.
2. **Payment processors restrict live-animal sales.** Stripe, PayPal, and
   Square all list animal sales as a restricted or prohibited business
   category in their acceptable-use terms (verify current terms before
   relying on this — they change). This is the concrete reason v1 has no
   in-app checkout: there may be no compliant way to process "buy this puppy"
   payments through a standard processor at all, independent of what Forming
   Paws wants to build.
3. **Nonprofit status and commerce.** `DESIGN.md` and the vault both note
   Forming Paws is pursuing 501(c)(3) status. A nonprofit running a
   commercial marketplace and taking a transaction cut raises unrelated
   business income tax (UBIT) questions that are separate from the animal-
   sale questions above. A listing fee (a flat fee to post, not a percentage
   of a sale) is the more defensible shape if fees are wanted at all, but
   that's a decision for whoever is handling the 501(c)(3) filing, not this
   document.
4. **Health-guarantee / "puppy lemon law" exposure.** Many states legally
   require specific written health disclosures on the sale of a dog. Whether
   Illinois has one that applies here, and what it would require Forming Paws
   to display or collect, is unresearched. Flagging so it isn't missed, not
   asserting an answer.

## What "litter caps" currently means: nothing, yet

The homepage's Health section already claims: *"Litter caps per profile,
mandatory documentation, and community reporting keep high-volume breeders
off the platform."* There is no litter-cap code anywhere in this repo --
`grep -rn "litter"` turns up two copy strings and nothing else. That claim
predates any marketplace work and is already a gap between what the site says
and what it does. A puppy marketplace is exactly the feature that claim
describes, so this plan treats implementing an actual cap as in scope rather
than optional -- shipping listings without it would make an existing
unverified claim newly and obviously false, which is the specific failure
mode this repo has been bitten by before (see `/education`'s
"expert-reviewed" correction and `/vets`'s own honesty banner).

## v1 scope: listings and inquiries, no checkout

Matches the 2026-08-26 decision. Concretely:

**In scope:**
- A breeder (an existing verified owner) lists a litter tied to two verified
  parent dogs already on the platform.
- Individual puppies within the litter get their own browsable listing
  (photos, sex, estimated ready-date, price *displayed as information*, not
  charged through the app).
- Interested buyers submit an inquiry -- the same interest/message primitive
  `dog_interests` and the owner-conversation feature already provide for
  adult-dog matching, reused rather than rebuilt.
- A litter cap, actually enforced: a hard limit on active litters per owner
  within a rolling window, checked at insert time.
- Listings inherit the existing health-verification gate: both parent dogs
  must already carry a verified health record before a litter can be listed.

**Explicitly out of scope for v1:**
- Any payment, deposit, or checkout flow through Forming Paws.
- Any escrow or delivery/shipping logistics.
- Any claim of legal compliance beyond "we do not process the sale."

## Data model sketch

Reuse over rebuild, matching how this repo has handled every other addition
(the `.fp-*` class redefinition pattern in `DESIGN.md`, `dogs_browsable`
instead of a parallel read path). A puppy is a dog -- young, and listed for
placement instead of for a breeding match -- so it lives in the existing
`dogs` table rather than a new parallel one.

```sql
-- New table: a litter groups puppies under two verified parent dogs.
create table public.litters (
  id uuid primary key default gen_random_uuid(),
  breeder_id uuid not null references public.owners(id) on delete cascade,
  sire_id uuid not null references public.dogs(id),
  dam_id uuid not null references public.dogs(id),
  born_on date,
  ready_on date,
  created_at timestamptz not null default now()
);

-- dogs gains two nullable columns. NULL on every existing row -- an adult
-- dog profile is completely unaffected.
alter table public.dogs
  add column litter_id uuid references public.litters(id),
  add column listed_price_cents integer; -- informational only; never charged
```

The litter cap becomes a real constraint instead of copy. The number is
already decided, just never implemented: the vault's `project-overview.md`
states **1 litter per dog per 12 months** under "Trust & Safety
(non-negotiable)," and `Execution Plan.md` says "litter caps enforced from
day one" -- neither ever happened in code. The constraint is a count of
litters where `sire_id = :dog or dam_id = :dog` and `created_at` within the
trailing 12 months, checked at insert time on `litters`, against either
parent.

Browsing puppy listings reuses `dogs_browsable` and `browse_dogs()` with a
`litter_id is not null` filter, the same pattern already used to keep
non-owner reads off the base `dogs` table -- see the "PostgREST embedded-
select silently filtered by an unrelated table's RLS" family of bugs this
repo has hit three times already; a fourth reuse of the same safe pattern is
cheaper than a fourth bug.

Inquiries reuse `dog_interests` as-is: an interest row pointed at a puppy's
`dogs.id` works today without a schema change, since a puppy listing is still
a row in `dogs`.

## Key flows (v1)

1. **List a litter.** Breeder selects two of their own verified dogs as
   sire/dam → cap check → litter created → breeder adds individual puppies
   (each a `dogs` row with `litter_id` set).
2. **Browse.** `/marketplace` (new route) lists puppies the same way
   `/browse` lists adult dogs today -- filter by breed, location, ready-date.
3. **Inquire.** A buyer expresses interest exactly like an adult-dog match
   today; mutual interest is not required here (the breeder decides), so this
   is closer to a one-sided inquiry than the mutual-match trigger `dogs`
   already has -- needs its own insert policy, not a reuse of
   `dog_interests`' mutual-match semantics unchanged.
4. **Arrange off-platform.** Price, deposit, and pickup happen outside the
   app, the same trust boundary the existing adult-dog matching flow already
   operates on (Forming Paws introduces; it doesn't supervise the outcome).

## Open questions for Stefan, not decided here

- Does a listing carry a fee at all in v1, and if so, flat per-listing or
  something else -- given the UBIT question above, this may need the
  501(c)(3) filing resolved first, not decided independently of it.
- Is `/vets`' PAWS Chicago referral the same standard for a puppy that fails
  the health-verification gate as it is for an adult dog, or does a puppy
  need a different threshold?
- Who actually reviews a real IL PA 102-0227 read before this ships -- this
  document flags the question, it doesn't answer it.

## What this plan does not do

It does not touch code. `app/page.tsx`'s roadmap now lists "Puppy
marketplace" under Next, honestly, as a real direction rather than a live
feature -- the same honesty pattern `/vets` and `/education` already use for
things that are planned but not yet real.
