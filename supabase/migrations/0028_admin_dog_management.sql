-- supabase/migrations/0028_admin_dog_management.sql
--
-- Admin management of any member's dogs, on a soft-delete model.
--
-- Removal is `removed_at`, never DELETE. Foreign keys cascade from dogs into
-- dog_photos, health_documents, dog_interests, matches and puppy_inquiries, so
-- a hard admin delete would destroy the verified vet records this platform's
-- health-gating claim rests on, plus every message thread the dog appeared in.
-- No dogs_delete_admin policy is added for the same reason.
--
-- Three of the surfaces below are security definer and bypass RLS entirely, so
-- each is restated IN FULL. browse_dogs carries its own warning about exactly
-- this: a restatement that drops `o.deactivated_at is null` silently un-hides
-- every deactivated owner. Both filters are preserved here and one is added.

alter table public.dogs
  add column removed_at timestamptz,
  add column removed_by uuid references public.owners(id) on delete set null;

comment on column public.dogs.removed_at is
  'Set by admin_remove_dog. A removed dog leaves discovery and its owner''s own '
  'list, but its health documents, photos rows and match threads are preserved. '
  'Admins still see it so it can be restored.';

-- Partial index on the column dogs_select_own actually filters by. An index on
-- (id) would just duplicate the primary key.
create index dogs_owner_not_removed_idx on public.dogs (owner_id) where removed_at is null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- An owner stops seeing their own removed dog. dogs_select_admin already exists
-- and is deliberately left UNFILTERED so an admin can see and restore.
drop policy if exists "dogs_select_own" on public.dogs;
create policy "dogs_select_own" on public.dogs
  for select to authenticated
  using (owner_id = auth.uid() and removed_at is null);

-- The actually-missing capability. USING is row-independent, so it also governs
-- the post-update row and an owner_id reassignment passes.
create policy "dogs_update_admin" on public.dogs
  for update to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Removal and restore
--
-- These mirror grant_role/revoke_role: the database is the real gate, and the
-- audit row is written by the caller (lib/auth/audit.ts) through the
-- authenticated client, so audit_log_insert_admin's actor_id = auth.uid()
-- check is satisfied by a real session rather than by a definer's identity.
-- ---------------------------------------------------------------------------

create or replace function public.admin_remove_dog(p_dog_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin may remove a dog' using errcode = '42501';
  end if;

  update public.dogs
     set removed_at = now(),
         removed_by = auth.uid()
   where id = p_dog_id
     and removed_at is null;

  if not found then
    raise exception 'Dog % does not exist or is already removed', p_dog_id;
  end if;
end;
$$;

create or replace function public.admin_restore_dog(p_dog_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin may restore a dog' using errcode = '42501';
  end if;

  update public.dogs
     set removed_at = null,
         removed_by = null
   where id = p_dog_id
     and removed_at is not null;

  if not found then
    raise exception 'Dog % does not exist or is not removed', p_dog_id;
  end if;
end;
$$;

-- /dogs/[id] needs to know whether a dog is removed, but a non-owner cannot read
-- dogs.removed_at at all — dogs_select_own filters the row away entirely, so a
-- direct select would return nothing and the check would quietly pass for every
-- dog on the site. This mirrors owner_is_active, which that page already calls
-- for exactly the same reason.
create or replace function public.dog_is_removed(p_dog_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select removed_at is not null from public.dogs where id = p_dog_id), false);
$$;

revoke all on function public.dog_is_removed(uuid) from public;
grant execute on function public.dog_is_removed(uuid) to authenticated;

revoke all on function public.admin_remove_dog(uuid, text) from public;
revoke all on function public.admin_restore_dog(uuid) from public;
grant execute on function public.admin_remove_dog(uuid, text) to authenticated;
grant execute on function public.admin_restore_dog(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Discovery surfaces. All three are security definer; RLS never reaches them.
-- Restated in full from the live definitions captured 2026-09-07 with
-- pg_get_functiondef against project wyzcnkdonbdykidmcxvx. The live bodies were
-- diffed line by line against these before they were written down; they matched
-- exactly, apart from the filters this migration deliberately adds.
-- ---------------------------------------------------------------------------

create or replace function public.browse_dogs(
  p_breed_id bigint default null,
  p_sex public.dog_sex default null,
  p_verified_only boolean default false,
  p_min_age_years int default null,
  p_max_age_years int default null,
  p_radius_miles numeric default null
)
returns table (
  id uuid, name text, breed_name text, sex public.dog_sex, birth_date date,
  owner_id uuid, location_label text, distance_miles numeric
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
    d.owner_id,
    o.location_label,
    case
      when me.location_point is not null and o.location_point is not null
        then st_distance(me.location_point, o.location_point) / 1609.34
      else null
    end as distance_miles
  from public.dogs d
  join public.breeds b on b.id = d.breed_id
  join public.owners o on o.id = d.owner_id
  left join public.owners me on me.id = auth.uid()
  where d.owner_id <> auth.uid()
    -- Carried forward from 0022. This function is defined by CREATE OR REPLACE,
    -- so any migration that restates it and omits this line silently un-hides
    -- every deactivated owner's dogs from browse — a member who asked us to
    -- delete their account would reappear in the feed.
    and o.deactivated_at is null
    -- Added by 0028. Same hazard, same rule: keep this line on every restatement.
    and d.removed_at is null
    and (p_breed_id is null or d.breed_id = p_breed_id)
    and (p_sex is null or d.sex = p_sex)
    and (p_verified_only is false or public.dog_is_baseline_verified(d.id))
    and (p_min_age_years is null or d.birth_date <= current_date - (p_min_age_years || ' years')::interval)
    -- "at most N years old" = has not yet reached its (N+1)th birthday, matched
    -- to the completed-calendar-year age shown on the card (see #34).
    and (p_max_age_years is null or d.birth_date > current_date - ((p_max_age_years + 1) || ' years')::interval)
    and (
      p_radius_miles is null
      or me.location_point is null
      or o.location_point is null
      or st_distance(me.location_point, o.location_point) / 1609.34 <= p_radius_miles
    )
  order by distance_miles nulls last, d.created_at desc;
$$;

-- browse_puppies never had the deactivation filter browse_dogs has. Its whole
-- owner-side predicate was `d.owner_id <> auth.uid()`, and
-- deactivate_own_account touches neither dogs nor litters — so a member who
-- deactivated kept their puppies listed on /marketplace. Verified latent, not
-- active (0 deactivated owners, 0 dogs with a litter_id on 2026-09-07), but it
-- goes live the moment puppy listings ship. Fixed here because this function is
-- already being restated.
create or replace function public.browse_puppies(
  p_breed_id bigint default null,
  p_radius_miles numeric default null
)
returns table (
  id uuid, name text, breed_name text, sex public.dog_sex, birth_date date,
  listed_price_cents integer, litter_id uuid, ready_on date, owner_id uuid,
  location_label text, distance_miles numeric
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
    and o.deactivated_at is null
    and d.removed_at is null
    and (p_breed_id is null or d.breed_id = p_breed_id)
    and (
      p_radius_miles is null
      or me.location_point is null
      or o.location_point is null
      or st_distance(me.location_point, o.location_point) / 1609.34 <= p_radius_miles
    )
  order by distance_miles nulls last, l.ready_on nulls last, d.created_at desc;
$$;

-- Both dog counts exclude removed dogs. dog_is_baseline_verified is
-- deliberately NOT filtered — it answers "does this dog hold current verified
-- documents" for a dog_id the caller already has, so filtering it would report
-- a removed dog as unverified to the admin deciding whether to restore it.
create or replace function public.community_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'members', (select count(*) from public.owners where coalesce(email,'') not like 'e2e-%' and coalesce(email,'') not like 'formingpaws.qa%'),
    'dogs', (select count(*) from public.dogs d join public.owners o on o.id = d.owner_id
              where coalesce(o.email,'') not like 'e2e-%' and coalesce(o.email,'') not like 'formingpaws.qa%'
                and d.removed_at is null),
    'verified_dogs', (select count(*) from public.dogs d
                       where d.removed_at is null and public.dog_is_baseline_verified(d.id))
  );
$$;

-- ---------------------------------------------------------------------------
-- Photos
--
-- 0019 coupled photo visibility to dogs_browsable so that a filter added to the
-- view would propagate automatically. That view is deliberately NOT filtered
-- here (0022: filtering it blanks dog names in every existing conversation and
-- in the review queue), so the propagation does not happen and the check has to
-- be stated directly. Without this a dog removed for abusive imagery keeps
-- serving that imagery to every signed-in member.
--
-- The owner-scoped policies dog_photos_select_own and
-- dog_photos_storage_owner_access are deliberately untouched, per 0019's note
-- that they must keep working independently of browsability. Policies are OR'd,
-- so narrowing only the browsable pair is sufficient and safe.
--
-- The removed_at check is stated through public.dog_is_removed() and NOT through
-- a join to public.dogs. PostgreSQL applies row-level security to tables
-- referenced inside a policy's USING expression (the same mechanism that
-- produces "infinite recursion detected in policy for relation"), and
-- public.dogs is owner-gated by dogs_select_own. Measured on production
-- 2026-09-07: a signed-in member reading public.dogs directly sees 9 of 20 rows,
-- while public.dogs_browsable returns all 20 because it is a plain
-- (non-security_invoker) view owned by postgres — that bypass is the only reason
-- cross-member photos resolve at all today, and both photo rows in production
-- belong to someone else's dog. So `join public.dogs d on d.id = b.id` inside
-- this policy would resolve only the viewer's OWN dogs and would blank every
-- other member's photos on /browse and /dogs/[id]. dog_is_removed is security
-- definer and reads dogs as its owner, which is the documented way out — the
-- same reason /dogs/[id] already calls owner_is_active instead of reading
-- owners.deactivated_at directly.
-- ---------------------------------------------------------------------------

drop policy if exists "dog_photos_select_browsable" on public.dog_photos;
create policy "dog_photos_select_browsable" on public.dog_photos
  for select to authenticated
  using (
    exists (
      select 1
      from public.dogs_browsable b
      where b.id = dog_photos.dog_id
        and not public.dog_is_removed(b.id)
    )
  );

drop policy if exists "dog_photos_storage_browsable_select" on storage.objects;
create policy "dog_photos_storage_browsable_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dog-photos'
    and exists (
      select 1
      from public.dogs_browsable b
      where b.id::text = (storage.foldername(objects.name))[1]
        and not public.dog_is_removed(b.id)
    )
  );
