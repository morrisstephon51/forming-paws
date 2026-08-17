-- supabase/migrations/0022_owner_settings_and_deactivation.sql
--
-- Account settings, and "delete my account" done as deactivate-then-purge.
--
-- The whole design turns on one fact: messages.sender_owner_id is declared
-- `on delete cascade` (0020). A hard delete therefore erases that member's
-- messages — including messages that are the evidence in an open harassment
-- report. Someone reported for bad behaviour could delete their account and
-- wipe the record you would review them on. So deletion is deferred, and the
-- purge refuses to run while a report is open.

-- ---------------------------------------------------------------------------
-- Drift, documented (same situation as the waitlist table in 0015)
-- ---------------------------------------------------------------------------
-- public.owners.email exists in production but no migration ever created it,
-- and the live handle_new_user() writes to it while the committed 0001 version
-- does not. Replaying this repo's migrations into an empty database therefore
-- produced a schema that differed from production. Both are reconciled here so
-- a fresh replay matches live.
--
-- Note it is written only by that security-definer trigger, never by the
-- client — which is why it is deliberately absent from the column grant below.
-- A member who could PATCH owners.email directly could desync it from
-- auth.users and show an admin an address they do not actually control.

alter table public.owners add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.owners (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;


alter table public.owners
  add column deactivated_at timestamptz,
  add column notify_matches boolean not null default true,
  add column notify_messages boolean not null default true,
  add column notify_health_reviews boolean not null default true;

-- Partial index: the purge scans only deactivated rows, which will always be a
-- tiny minority of the table.
create index owners_deactivated_at_idx on public.owners (deactivated_at)
  where deactivated_at is not null;


-- ---------------------------------------------------------------------------
-- Who may write what
-- ---------------------------------------------------------------------------
--
-- owners_update_own (0001) already confines a member to their own row. What it
-- cannot do is confine which *columns* of that row they write: an RLS policy
-- sees the old row in USING and the new row in WITH CHECK, and can reference
-- neither from the other, so "deactivated_at is unchanged" is not expressible
-- as a policy predicate.
--
-- Column-level privileges are. Without this, a member could PATCH
-- deactivated_at to null by direct REST call and silently cancel their own
-- pending deletion, or backdate it and skip past the open-report check below.

revoke update on public.owners from authenticated;
grant update (display_name, location_label, location_point,
              notify_matches, notify_messages, notify_health_reviews)
  on public.owners to authenticated;


create or replace function public.deactivate_own_account()
returns void
language sql
security definer
set search_path = public
as $$
  update public.owners
     set deactivated_at = now()
   where id = auth.uid()
     and deactivated_at is null;
$$;

create or replace function public.reactivate_own_account()
returns void
language sql
security definer
set search_path = public
as $$
  update public.owners
     set deactivated_at = null
   where id = auth.uid();
$$;

grant execute on function public.deactivate_own_account to authenticated;
grant execute on function public.reactivate_own_account to authenticated;


-- ---------------------------------------------------------------------------
-- Where deactivation is honoured, and where it deliberately is not
-- ---------------------------------------------------------------------------
--
-- browse_dogs() is the discovery feed, so it filters. dogs_browsable does NOT,
-- and that is not an oversight:
--
--   app/matches/page.tsx, app/matches/[id]/page.tsx and
--   app/admin/review-queue/page.tsx all read dogs_browsable to resolve dog
--   NAMES. Filtering the view would blank the dog's name in every existing
--   conversation and in the admin queue — the same "query silently filtered by
--   another table's access" failure this repo has now hit four times. An empty
--   thread also reads as data loss to the owner still in it.
--
-- /dogs/[id] gets an explicit check in the page instead, because a direct URL
-- to a deactivated owner's dog should 404 for everyone but its owner.

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
    and o.deactivated_at is null
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


-- Is this owner still active?
--
-- security definer because owners' RLS is owners_select_own (0001): a member
-- reading another member's row gets nothing back. A page that checked
-- `select deactivated_at from owners where id = <someone else>` would therefore
-- always read null and conclude "active" — the check would silently never fire.
-- That is the fourth-recurring failure in this repo, so it is centralised here
-- rather than left as a query each page has to get right.
--
-- Returns only a boolean, never the timestamp: when a member left is nobody
-- else's business.
create or replace function public.owner_is_active(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select o.deactivated_at is null from public.owners o where o.id = p_owner_id),
    false
  );
$$;

grant execute on function public.owner_is_active to authenticated;


-- Owner ids whose dogs are involved in a report that is still being worked.
-- Covers BOTH parties, not only the reported one: if the reporter purges, their
-- half of the conversation cascades away and the admin is left reviewing a
-- one-sided thread — evidence damaged just as surely.
create or replace function public.owners_locked_by_open_report()
returns table (owner_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct d.owner_id
  from public.match_reports r
  join public.matches m on m.id = r.match_id
  join public.dogs d on d.id in (m.dog_a_id, m.dog_b_id)
  where r.status in ('open', 'reviewing');
$$;


create or replace function public.owners_due_for_purge(p_grace interval default interval '30 days')
returns table (owner_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select o.id
  from public.owners o
  where o.deactivated_at is not null
    and o.deactivated_at < now() - p_grace
    and o.id not in (select owner_id from public.owners_locked_by_open_report());
$$;


-- Deleting from auth.users cascades to public.owners and everything below it.
create or replace function public.purge_deactivated_accounts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purged integer;
begin
  with doomed as (
    select owner_id from public.owners_due_for_purge()
  ), gone as (
    delete from auth.users u
    using doomed
    where u.id = doomed.owner_id
    returning u.id
  )
  select count(*) into purged from gone;

  return purged;
end;
$$;

-- Not granted to authenticated. Only the scheduler and an admin at the SQL
-- console should ever be able to run this.
revoke execute on function public.purge_deactivated_accounts from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Schedule
-- ---------------------------------------------------------------------------
-- Committed here rather than clicked into the dashboard, so the schedule is
-- reviewable and travels with the repo. Daily at 04:10 UTC — off the hour to
-- avoid the stampede every other cron job on the box is part of.

create extension if not exists pg_cron;

select cron.schedule(
  'purge-deactivated-accounts',
  '10 4 * * *',
  $cron$ select public.purge_deactivated_accounts(); $cron$
);
