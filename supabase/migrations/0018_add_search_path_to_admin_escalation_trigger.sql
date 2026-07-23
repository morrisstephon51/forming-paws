-- supabase/migrations/0018_add_search_path_to_admin_escalation_trigger.sql

-- Advisor-flagged inconsistency: every other function in this codebase sets
-- search_path explicitly; this one didn't. Not an active vulnerability today
-- (the function references no unqualified table names), but closing it for
-- consistency.
create or replace function public.prevent_owner_self_admin_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.uid() is not null then
    raise exception 'is_admin cannot be changed by the owner themselves';
  end if;
  return new;
end;
$$;
