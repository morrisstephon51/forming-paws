-- supabase/migrations/0027_audit_log.sql
--
-- Append-only record of privileged actions. Admins read; nobody updates or
-- deletes -- there are deliberately no UPDATE/DELETE policies. Requires 0026,
-- which defines public.has_role().

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.owners(id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log_select_admin" on public.audit_log
  for select to authenticated using (public.has_role('admin'));

-- Only admins perform the actions this log records, so only admins may write to
-- it. Without the has_role check any authenticated user could inject rows.
create policy "audit_log_insert_admin" on public.audit_log
  for insert to authenticated
  with check (actor_id = auth.uid() and public.has_role('admin'));
