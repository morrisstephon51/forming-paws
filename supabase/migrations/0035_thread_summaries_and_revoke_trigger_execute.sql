-- Unread counts and thread previews, aggregated in Postgres instead of in the app.
--
-- /dashboard and /matches each pulled every message row the member could see and
-- counted them in TypeScript. PostgREST caps a response at 1000 rows, so that
-- count silently went wrong once a member's threads passed a thousand messages —
-- a badge showing a confidently incorrect number, with nothing to signal it.
--
-- security invoker on purpose: the RLS policies on messages and match_reads are
-- what scope this to the caller. A security definer function here would have to
-- re-implement that gate, and re-implementing this particular gate is how the
-- moderation path was broken once already.
--
-- The HAVING clause narrows to conversations the caller is actually in. RLS also
-- lets an admin read messages while a report is open, and without this an admin
-- would carry a reported thread's messages in their own unread badge.
--
-- A message stamped exactly at last_read_at counts as read: opening a thread
-- stamps now(), so under >= the message that triggered the read would stay
-- unread forever.
create or replace function public.match_thread_summaries()
returns table (
  match_id uuid,
  unread bigint,
  last_body text,
  last_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.match_id,
    count(*) filter (
      where m.sender_owner_id <> auth.uid()
        and (r.last_read_at is null or m.created_at > r.last_read_at)
    )::bigint,
    (array_agg(m.body order by m.created_at desc))[1],
    max(m.created_at)
  from public.messages m
  left join public.match_reads r
    on r.match_id = m.match_id and r.owner_id = auth.uid()
  group by m.match_id
  having public.owner_in_match(m.match_id)
$$;

revoke execute on function public.match_thread_summaries() from public;
grant execute on function public.match_thread_summaries() to authenticated;

-- handle_new_user is a trigger function, but it sits in the public schema, so
-- PostgREST publishes it at /rest/v1/rpc/handle_new_user where anon can call it.
-- Postgres refuses to run a trigger function outside a trigger, so this is a
-- closed door rather than a fixed break — but an unauthenticated caller should
-- not be able to reach a security definer function at all.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
