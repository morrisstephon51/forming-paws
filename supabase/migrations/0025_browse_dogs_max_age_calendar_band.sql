-- supabase/migrations/0024_browse_dogs_max_age_calendar_band.sql
--
-- Fix: the browse "max age" filter was off by one whole year relative to the
-- age shown on the card, so it hid dogs that genuinely match.
--
-- The card labels each dog with COMPLETED calendar years (lib/age.ts
-- `ageInYears`, added in #34 so the label agrees with the min-age filter). The
-- min-age predicate in browse_dogs (0009) is calendar-correct and matches that
-- label:
--     birth_date <= current_date - N years        -- completed age >= N
--
-- But the max-age predicate was written as the naive mirror:
--     birth_date >= current_date - N years         -- actual age <= N.0 by date
-- which is NOT "completed age <= N". A dog whose completed age is exactly N but
-- whose real age is N years plus some months (e.g. a 3-years-6-months dog,
-- labelled "3yo") has birth_date < current_date - N years, so it FAILS this
-- guard. The filter therefore drops almost every dog at the top of each age
-- band while the card still labels them inside it.
--
-- Worked example (today = 2026-08-15), search "max age 3":
--   card age 3, born 2023-02-01  -> OLD excludes (2023-02-01 < 2023-08-15), BUG
--   card age 3, born 2022-08-16  -> OLD excludes (2022-08-16 < 2023-08-15), BUG
-- And "min 3 AND max 3" (exactly-3-year-olds) collapses to only dogs born on
-- exactly 2023-08-15 -- the single boundary day -- instead of the whole band.
--
-- Root cause + fix: "completed age <= N" means the dog has NOT yet had its
-- (N+1)th birthday, i.e. birth_date > current_date - (N+1) years (strict). This
-- mirrors the deployed min-age predicate's calendar-correct construction; only
-- this one line changes. Verified by calendar-correct simulation of both
-- predicates against the `ageInYears` oracle (see PR description for the live
-- read-only SQL check to confirm against the project).
--
-- security definer / search_path / grants are unchanged from 0009 + 0010;
-- CREATE OR REPLACE preserves privileges, and the grants below are re-asserted
-- to keep this file self-documenting about the anon-revoke posture from 0010.

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
    -- Carried forward from 0022. This function is defined by CREATE OR REPLACE,
    -- so any migration that restates it and omits this line silently un-hides
    -- every deactivated owner's dogs from browse — a member who asked us to
    -- delete their account would reappear in the feed.
    and o.deactivated_at is null
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

-- Re-assert the grant posture from 0010 (anon/public revoked, authenticated
-- only). CREATE OR REPLACE keeps existing privileges, so this is belt-and-suspenders.
revoke execute on function public.browse_dogs from anon, public;
grant execute on function public.browse_dogs to authenticated;
