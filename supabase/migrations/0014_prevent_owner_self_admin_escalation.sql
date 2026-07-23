-- supabase/migrations/0014_prevent_owner_self_admin_escalation.sql

-- auth.uid() is null when a statement runs without a JWT context (e.g. direct
-- SQL via the Supabase MCP execute_sql tool or the dashboard SQL editor,
-- which run as the postgres/service role) and non-null for any request that
-- came in through PostgREST with a user's access token. This lets the
-- existing "grant admin via SQL" operational path (per the Phase 2 spec)
-- keep working while blocking the same change over the authenticated REST
-- API.
create or replace function public.prevent_owner_self_admin_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.uid() is not null then
    raise exception 'is_admin cannot be changed by the owner themselves';
  end if;
  return new;
end;
$$;

create trigger owners_prevent_self_admin_escalation
  before update on public.owners
  for each row execute function public.prevent_owner_self_admin_escalation();
