-- supabase/migrations/0026_puppy_marketplace.sql
--
-- Puppy marketplace v1: listings and in-app inquiries, no checkout. See
-- docs/superpowers/specs/2026-09-03-puppy-marketplace-design.md for the full
-- plan this implements, including the legal considerations that scoped it to
-- exactly this (no payment moves through Forming Paws).
--
-- A puppy is a dog -- young, and listed for placement instead of a breeding
-- match -- so it lives in the existing `dogs` table (two new nullable
-- columns) rather than a parallel one. Every existing row gets NULL for both,
-- so no existing dog profile, query, or policy is affected.

create table public.litters (
  id uuid primary key default gen_random_uuid(),
  breeder_id uuid not null references public.owners(id) on delete cascade,
  sire_id uuid not null references public.dogs(id),
  dam_id uuid not null references public.dogs(id),
  born_on date,
  ready_on date,
  created_at timestamptz not null default now(),
  constraint litters_sire_dam_distinct check (sire_id <> dam_id)
);

alter table public.litters enable row level security;

create policy "litters_select_own" on public.litters
  for select to authenticated using (breeder_id = auth.uid());

create policy "litters_delete_own" on public.litters
  for delete to authenticated using (breeder_id = auth.uid());

-- The anti-mill cap this repo has claimed in marketing copy since launch
-- ("Litter caps per profile") and named a number for in the original plan
-- (project-overview.md: "1 litter/dog/12mo") but never implemented. Not
-- security definer: it is only ever evaluated from litters_insert_own_verified
-- below, where the caller has already been shown to own both parent dogs, so
-- plain RLS (a breeder only ever sees their own litters) is exactly the scope
-- this check needs.
create or replace function public.litter_cap_ok(p_dog_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select count(*) < 1
  from public.litters
  where (sire_id = p_dog_id or dam_id = p_dog_id)
    and created_at >= (now() - interval '12 months');
$$;

grant execute on function public.litter_cap_ok to authenticated;

-- dogs gains its two new columns BEFORE any policy below references
-- litter_id -- litters_insert_own_verified does, a few statements down, and
-- referencing a column that doesn't exist yet would fail the migration.
alter table public.dogs
  add column litter_id uuid references public.litters(id) on delete cascade,
  add column listed_price_cents integer;

alter table public.dogs
  add constraint dogs_listed_price_non_negative
  check (listed_price_cents is null or listed_price_cents >= 0);

-- A price displayed as information only. No column, trigger, or function
-- anywhere in this migration moves money -- see the spec for why (payment
-- processors restrict live-animal sales as a category; this repo has no
-- payment library installed at all).

-- Mirrors dog_interests_insert_own_verified's shape (0011): both parents must
-- be the breeder's own dogs, of the right sex, already health-verified, and
-- under the cap. Also excludes puppies (dogs.litter_id is not null) as
-- parents -- a listing can't itself be a breeding dog.
create policy "litters_insert_own_verified" on public.litters
  for insert to authenticated
  with check (
    breeder_id = auth.uid()
    and exists (
      select 1 from public.dogs
      where id = sire_id and owner_id = auth.uid() and sex = 'male' and litter_id is null
    )
    and exists (
      select 1 from public.dogs
      where id = dam_id and owner_id = auth.uid() and sex = 'female' and litter_id is null
    )
    and public.dog_is_baseline_verified(sire_id)
    and public.dog_is_baseline_verified(dam_id)
    and public.litter_cap_ok(sire_id)
    and public.litter_cap_ok(dam_id)
  );

-- dogs_insert_own (0003) already lets any owner insert a dog row for
-- themselves; it says nothing about litter_id, so on its own it would let an
-- owner attach a puppy to a litter they don't run. A RESTRICTIVE policy ANDs
-- with the existing permissive one instead of replacing it -- the existing
-- policy and its behaviour for ordinary (non-puppy) dogs is untouched.
create policy "dogs_litter_ownership_on_insert" on public.dogs
  as restrictive
  for insert to authenticated
  with check (
    litter_id is null
    or exists (select 1 from public.litters where id = litter_id and breeder_id = auth.uid())
  );

create policy "dogs_litter_ownership_on_update" on public.dogs
  as restrictive
  for update to authenticated
  with check (
    litter_id is null
    or exists (select 1 from public.litters where id = litter_id and breeder_id = auth.uid())
  );

-- dogs_browsable (0009) gains two trailing columns. CREATE OR REPLACE VIEW
-- only allows appending columns, never reordering or removing them, which is
-- exactly the constraint that keeps every existing explicit-column select
-- against this view (app/dogs/[id]/page.tsx, app/browse/page.tsx) unaffected.
create or replace view public.dogs_browsable as
select
  d.id,
  d.owner_id,
  d.name,
  d.breed_id,
  b.name as breed_name,
  d.sex,
  d.birth_date,
  d.created_at,
  d.litter_id,
  d.listed_price_cents
from public.dogs d
join public.breeds b on b.id = d.breed_id;

-- CREATE OR REPLACE VIEW preserves existing grants in Postgres, but this repo
-- has a real history of grant bugs (0010, and the anon-readable functions
-- fixed in 0025) -- re-issuing explicitly costs nothing and removes any doubt.
grant select on public.dogs_browsable to authenticated;

-- Server-side search for puppy listings, mirroring browse_dogs (0009)
-- exactly except: filtered to litter_id is not null, no verified/age/sex
-- filters (a litter's own fields cover what matters), and surfaces ready_on.
create or replace function public.browse_puppies(
  p_breed_id bigint default null,
  p_radius_miles numeric default null
)
returns table (
  id uuid,
  name text,
  breed_name text,
  sex public.dog_sex,
  birth_date date,
  listed_price_cents integer,
  litter_id uuid,
  ready_on date,
  owner_id uuid,
  location_label text,
  distance_miles numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.name,
    b.name as breed_name,
    d.sex,
    d.birth_date,
    d.listed_price_cents,
    d.litter_id,
    l.ready_on,
    d.owner_id,
    o.location_label,
    case
      when me.location_point is not null and o.location_point is not null
        then st_distance(me.location_point, o.location_point) / 1609.34
      else null
    end as distance_miles
  from public.dogs d
  join public.breeds b on b.id = d.breed_id
  join public.litters l on l.id = d.litter_id
  join public.owners o on o.id = d.owner_id
  left join public.owners me on me.id = auth.uid()
  where d.litter_id is not null
    and d.owner_id <> auth.uid()
    and (p_breed_id is null or d.breed_id = p_breed_id)
    and (
      p_radius_miles is null
      or me.location_point is null
      or o.location_point is null
      or st_distance(me.location_point, o.location_point) / 1609.34 <= p_radius_miles
    )
  order by distance_miles nulls last, l.ready_on nulls last, d.created_at desc;
$$;

grant execute on function public.browse_puppies to authenticated;

-- Inquiries. Deliberately NOT dog_interests: that table requires the caller
-- to express interest FROM one of their own verified dogs, which models a
-- mutual breeding match between two dogs, not a buyer asking about a puppy --
-- a buyer may not own a dog at all yet. A one-sided inquiry with its own
-- table is the honest shape, not a reuse that would silently create dog rows
-- or matches that mean something different from what happened.
create table public.puppy_inquiries (
  id uuid primary key default gen_random_uuid(),
  puppy_id uuid not null references public.dogs(id) on delete cascade,
  buyer_id uuid not null references public.owners(id) on delete cascade,
  buyer_email text not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint puppy_inquiries_unique unique (puppy_id, buyer_id),
  constraint puppy_inquiries_message_len check (length(btrim(message)) between 1 and 2000),
  constraint puppy_inquiries_email_len check (length(buyer_email) between 3 and 254)
);

alter table public.puppy_inquiries enable row level security;

-- buyer_email must match the caller's own owners.email, not an arbitrary
-- client-submitted value -- otherwise anyone could submit an inquiry under a
-- fake contact address. Mirrors the same intent as contact_messages'
-- length-bound insert check (0023): validate in the policy, since PostgREST
-- is reachable directly and the app is not the only thing that can insert.
create policy "puppy_inquiries_insert_own" on public.puppy_inquiries
  for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and buyer_email = (select email from public.owners where id = auth.uid())
    and exists (
      select 1 from public.dogs
      where id = puppy_id and litter_id is not null and owner_id <> auth.uid()
    )
  );

create policy "puppy_inquiries_select_buyer_or_breeder" on public.puppy_inquiries
  for select to authenticated using (
    buyer_id = auth.uid()
    or exists (select 1 from public.dogs where id = puppy_id and owner_id = auth.uid())
  );
