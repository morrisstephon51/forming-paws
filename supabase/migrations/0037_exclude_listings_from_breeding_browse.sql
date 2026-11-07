-- supabase/migrations/0037_exclude_listings_from_breeding_browse.sql
--
-- browse_dogs is the breeding-match discovery surface (/browse); browse_puppies
-- is the marketplace one (/marketplace). 0026 introduced puppy listings as rows
-- in public.dogs carrying a non-null litter_id, and added browse_puppies filtered
-- to `d.litter_id is not null`. The complementary filter was never added to
-- browse_dogs, so a puppy listed for placement shows up in BOTH surfaces: once on
-- /marketplace (correct) and once in the breeding feed at /browse (wrong).
--
-- The rest of the codebase already treats a listing as ineligible for breeding.
-- litters_insert_own_verified (0026) requires `litter_id is null` on both parents
-- with the comment "a listing can't itself be a breeding dog", and
-- app/dogs/[id]/page.tsx branches on litter_id to render PuppyInquiryForm instead
-- of ExpressInterestForm. browse_dogs is the one breeding surface that never got
-- the partition, so a member browsing for a match sees for-sale puppies mixed in,
-- and clicking one lands on an inquiry form rather than an interest form.
--
-- Fix: add `d.litter_id is null` to browse_dogs -- the exact inverse of
-- browse_puppies' `d.litter_id is not null`. Nothing else changes.
--
-- CREATE OR REPLACE, so every other filter must be carried forward unchanged.
-- 0024 and 0028 both warn about this by name: a restatement that drops
-- `o.deactivated_at is null` silently un-hides deactivated owners, and one that
-- drops `d.removed_at is null` un-hides moderated dogs. Both lines are preserved
-- below verbatim from 0028's live definition; the ONLY addition is the litter_id
-- filter.
--
-- Dormant on today's data (0 dogs carry a litter_id on the last fleet read),
-- exactly like the sibling filters 0028 added to browse_puppies; it goes live the
-- moment puppy listings ship. Cheaper to state now than to diagnose then.

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
    -- Carried forward from 0022/0028. A restatement that omits this silently
    -- un-hides every deactivated owner's dogs from browse.
    and o.deactivated_at is null
    -- Carried forward from 0028. Same hazard, same rule: keep this line.
    and d.removed_at is null
    -- Added by 0037. A puppy listed on the marketplace (litter_id is not null) is
    -- not a breeding candidate -- browse_puppies owns that surface, and the litter
    -- path (0026) already refuses a listing as a parent. Exact inverse of
    -- browse_puppies' `d.litter_id is not null`.
    and d.litter_id is null
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

-- Re-assert the grant posture (anon/public revoked, authenticated only), as 0024
-- does. CREATE OR REPLACE preserves existing privileges, so this is
-- belt-and-suspenders and keeps the file self-documenting about the anon-revoke
-- discipline from 0010/0029.
revoke execute on function public.browse_dogs from anon, public;
grant execute on function public.browse_dogs to authenticated;
