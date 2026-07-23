-- supabase/migrations/0009_browse_dogs.sql

-- Fix: dog_is_baseline_verified must bypass RLS to correctly report verification
-- status for dogs the caller doesn't own (needed for the browse/detail views below).
create or replace function public.dog_is_baseline_verified(p_dog_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.health_documents
      where dog_id = p_dog_id
        and doc_type = 'vet_exam'
        and status = 'verified'
        and document_date >= (current_date - interval '12 months')
    )
    and exists (
      select 1 from public.health_documents
      where dog_id = p_dog_id
        and doc_type = 'vaccination'
        and status = 'verified'
    );
$$;

-- Public read of a limited column set for browsing (spec: "Public read of a
-- limited column set ... for all signed-in owners"). weight_lbs and
-- temperament_notes are deliberately excluded. This view is created by the
-- migration-running role, which bypasses the dogs table's owner-only RLS —
-- the base `dogs` table itself stays owner-only; only these columns are ever
-- exposed for rows the caller doesn't own.
create view public.dogs_browsable as
select
  d.id,
  d.owner_id,
  d.name,
  d.breed_id,
  b.name as breed_name,
  d.sex,
  d.birth_date,
  d.created_at
from public.dogs d
join public.breeds b on b.id = d.breed_id;

grant select on public.dogs_browsable to authenticated;

-- dog_photos has no sensitive columns (just a storage pointer + position), so
-- open row-level SELECT to all authenticated users for browsing thumbnails.
create policy "dog_photos_select_browsable" on public.dog_photos
  for select to authenticated using (true);

-- Same for the storage objects themselves — a new SELECT-only policy so any
-- authenticated user can generate a signed URL for any dog's photo. Insert/
-- update/delete stay owner-only via the existing "for all" policy.
create policy "dog_photos_storage_browsable_select" on storage.objects
  for select using (bucket_id = 'dog-photos');

-- Server-side search + distance calculation. security definer so it can read
-- other owners' location_point (otherwise blocked by owners' own-row-only
-- RLS) to compute distance — but it only ever returns the computed number,
-- never the raw point.
create or replace function public.browse_dogs(
  p_breed_id bigint default null,
  p_sex public.dog_sex default null,
  p_verified_only boolean default false,
  p_min_age_years int default null,
  p_max_age_years int default null,
  p_radius_miles numeric default null
)
returns table (
  id uuid,
  name text,
  breed_name text,
  sex public.dog_sex,
  birth_date date,
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
    and (p_breed_id is null or d.breed_id = p_breed_id)
    and (p_sex is null or d.sex = p_sex)
    and (p_verified_only is false or public.dog_is_baseline_verified(d.id))
    and (p_min_age_years is null or d.birth_date <= current_date - (p_min_age_years || ' years')::interval)
    and (p_max_age_years is null or d.birth_date >= current_date - (p_max_age_years || ' years')::interval)
    and (
      p_radius_miles is null
      or me.location_point is null
      or o.location_point is null
      or st_distance(me.location_point, o.location_point) / 1609.34 <= p_radius_miles
    )
  order by distance_miles nulls last, d.created_at desc;
$$;

grant execute on function public.browse_dogs to authenticated;
