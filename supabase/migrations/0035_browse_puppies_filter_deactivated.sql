-- supabase/migrations/0035_browse_puppies_filter_deactivated.sql
--
-- browse_puppies (0026) was modelled on browse_dogs (0009) but the deactivated-
-- owner guard that browse_dogs acquired in 0022 was not carried forward.
-- When an owner deactivates their account their breeding dogs correctly
-- disappear from /browse, but their puppy listings stayed visible on
-- /marketplace.  A buyer submitting an inquiry to such a listing can never
-- receive a reply until the owner reactivates.
--
-- Fix: add `o.deactivated_at is null` to browse_puppies, matching the guard
-- browse_dogs has carried since 0022.

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
    and o.deactivated_at is null
    and (p_breed_id is null or d.breed_id = p_breed_id)
    and (
      p_radius_miles is null
      or me.location_point is null
      or o.location_point is null
      or st_distance(me.location_point, o.location_point) / 1609.34 <= p_radius_miles
    )
  order by distance_miles nulls last, l.ready_on nulls last, d.created_at desc;
$$;
