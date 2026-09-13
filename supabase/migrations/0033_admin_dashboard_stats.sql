-- supabase/migrations/0033_admin_dashboard_stats.sql
--
-- The admin console's home page, /admin, reads every figure through one
-- function. Spec: docs/superpowers/specs/2026-09-12-admin-dashboard-design.md
--
--   1. is_test_account(email): the single test-account rule.
--   2. community_stats() restated to use it. Its live definition was verified
--      identical to 0028's on 2026-09-12; re-read it before applying, because
--      `create or replace` silently discards anything added since.
--   3. admin_dashboard_stats(): admin-only aggregates. No names, emails or
--      message bodies ever leave it.
--
-- Why exclusion matters: on 2026-09-12, 37 of 50 accounts were e2e signups
-- written to production on every test run. Counted raw they made activation
-- look like a 74% leak; with them removed it was 85%.


-- 1 --------------------------------------------------------------------------
create or replace function public.is_test_account(p_email text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_email, '') like 'e2e-%'
      or coalesce(p_email, '') like 'formingpaws.qa%';
$$;

-- This project's default ACL grants EXECUTE on new functions directly to anon
-- (see 0029), and `revoke ... from public` does not remove a direct grant.
-- Security-definer callers run with their owner's privileges, so anon needs
-- no grant to benefit from this function inside community_stats().
revoke all on function public.is_test_account(text) from anon, public;
grant execute on function public.is_test_account(text) to authenticated;


-- 2 --------------------------------------------------------------------------
-- Output identical to 0028's body: only the two inline exclusion clauses are
-- replaced. `verified_dogs` never filtered test accounts and still does not.
-- `create or replace` keeps the existing anon + authenticated grants, which
-- are intentional: this backs public site figures.
create or replace function public.community_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'members', (select count(*) from public.owners where not public.is_test_account(email)),
    'dogs', (select count(*) from public.dogs d join public.owners o on o.id = d.owner_id
              where not public.is_test_account(o.email)
                and d.removed_at is null),
    'verified_dogs', (select count(*) from public.dogs d
                       where d.removed_at is null and public.dog_is_baseline_verified(d.id))
  );
$$;


-- 3 --------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
  window_start constant timestamptz := now() - interval '30 days';
begin
  -- has_role reads auth.uid() from the request JWT, so it identifies the real
  -- caller even inside security definer; grant_role relies on the same thing.
  if not public.has_role('admin') then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  with real_users as (
    select u.id, u.email_confirmed_at, u.last_sign_in_at, u.created_at
    from auth.users u
    where not public.is_test_account(u.email)
  ),
  real_dogs as (
    select d.id, d.owner_id, d.removed_at
    from public.dogs d
    where d.owner_id in (select id from real_users)
  ),
  live_dogs as (
    select id, owner_id from real_dogs where removed_at is null
  ),
  pending_docs as (
    select uploaded_at from public.health_documents where status = 'pending_review'
  ),
  real_messages as (
    select match_id, created_at from public.messages
    where sender_owner_id in (select id from real_users)
  ),
  weeks as (
    select generate_series(
      date_trunc('week', now()) - interval '7 weeks',
      date_trunc('week', now()),
      interval '1 week'
    ) as week_start
  )
  select json_build_object(
    'meta', json_build_object(
      'generated_at', now(),
      'test_accounts_excluded', (select count(*) from auth.users u where public.is_test_account(u.email))
    ),

    -- Work queues. NOT filtered for test accounts: each count links to a page
    -- that lists every row, and the two must agree.
    'attention', json_build_object(
      'docs_pending', (select count(*) from pending_docs),
      'oldest_pending_uploaded_at', (select min(uploaded_at) from pending_docs),
      'reports_open', (select count(*) from public.match_reports where status in ('open', 'reviewing')),
      'contact_unhandled', (select count(*) from public.contact_messages where handled_at is null),
      'dogs_removed', (select count(*) from public.dogs where removed_at is not null)
    ),

    -- Each step is computed independently over real users, not chained.
    'funnel', json_build_object(
      'signed_up', (select count(*) from real_users),
      'confirmed', (select count(*) from real_users where email_confirmed_at is not null),
      'signed_in', (select count(*) from real_users where last_sign_in_at is not null),
      'added_dog', (select count(distinct owner_id) from live_dogs),
      'verified_dog', (select count(distinct ld.owner_id) from live_dogs ld
                        where public.dog_is_baseline_verified(ld.id)),
      'matched', (select count(distinct ld.owner_id) from live_dogs ld
                   where exists (select 1 from public.matches m
                                 where m.dog_a_id = ld.id or m.dog_b_id = ld.id))
    ),

    -- Zero-filled: a week with no signups is present with 0, never omitted.
    'signups_by_week', (
      select json_agg(
               json_build_object(
                 'week_start', w.week_start::date,
                 'signups', (select count(*) from real_users ru
                             where date_trunc('week', ru.created_at) = w.week_start))
               order by w.week_start)
      from weeks w
    ),

    -- One predicate per metric; the 30-day window is a FILTER on the same scan,
    -- so all-time and last-30-days can never disagree about who counts.
    'engagement', json_build_object(
      'interests', (
        select json_build_object('total', count(*),
                                 'last_30d', count(*) filter (where di.created_at > window_start))
        from public.dog_interests di
        where di.expressing_dog_id in (select id from real_dogs)
      ),
      'matches', (
        select json_build_object('total', count(*),
                                 'last_30d', count(*) filter (where m.matched_at > window_start))
        from public.matches m
        where m.dog_a_id in (select id from real_dogs) or m.dog_b_id in (select id from real_dogs)
      ),
      'messages', (
        select json_build_object('total', count(*),
                                 'last_30d', count(*) filter (where created_at > window_start))
        from real_messages
      ),
      'active_conversations', (
        select json_build_object('last_30d', count(distinct match_id) filter (where created_at > window_start))
        from real_messages
      ),
      'litters', (
        select json_build_object('total', count(*),
                                 'last_30d', count(*) filter (where l.created_at > window_start))
        from public.litters l
        where l.breeder_id in (select id from real_users)
      ),
      'puppy_inquiries', (
        select json_build_object('total', count(*),
                                 'last_30d', count(*) filter (where pi.created_at > window_start))
        from public.puppy_inquiries pi
        where pi.buyer_id is null or pi.buyer_id in (select id from real_users)
      )
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_dashboard_stats() from anon, public;
grant execute on function public.admin_dashboard_stats() to authenticated;
