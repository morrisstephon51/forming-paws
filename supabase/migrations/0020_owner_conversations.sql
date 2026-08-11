-- Owner-to-owner conversations on a mutual match.
--
-- A match is between two dogs, but people do the talking, so messages belong to
-- owners. Everything here is authorised by RLS; the application never decides
-- who may read a thread.

create type public.report_reason as enum (
  'harassment', 'spam', 'animal_welfare', 'suspected_fake_documents', 'other'
);

create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_owner_id uuid not null references public.owners(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_match_created_idx on public.messages (match_id, created_at);

create table public.match_reads (
  match_id uuid not null references public.matches(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (match_id, owner_id)
);

create table public.match_blocks (
  match_id uuid not null references public.matches(id) on delete cascade,
  blocker_owner_id uuid not null references public.owners(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, blocker_owner_id)
);

create table public.match_reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  reporter_owner_id uuid not null references public.owners(id) on delete cascade,
  reason public.report_reason not null,
  detail text check (detail is null or length(btrim(detail)) between 1 and 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_notes text
);
create index match_reports_status_idx on public.match_reports (status, created_at);

-- security definer so the dogs join is not re-filtered by dogs' own RLS, which
-- is owner-scoped. This is the ONLY place that join lives; every policy below
-- calls it rather than repeating it.
create or replace function public.owner_in_match(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.matches m
    join public.dogs d on d.id in (m.dog_a_id, m.dog_b_id)
    where m.id = p_match_id and d.owner_id = auth.uid()
  );
$$;

-- Either party blocking closes the thread for both.
create or replace function public.match_is_blocked(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.match_blocks b where b.match_id = p_match_id);
$$;

-- Supabase grants EXECUTE to anon/authenticated by default at creation time.
-- Migration 0010 exists because that was missed once already.
revoke execute on function public.owner_in_match(uuid) from anon, public;
grant execute on function public.owner_in_match(uuid) to authenticated;
revoke execute on function public.match_is_blocked(uuid) from anon, public;
grant execute on function public.match_is_blocked(uuid) to authenticated;

alter table public.messages enable row level security;
alter table public.match_reads enable row level security;
alter table public.match_blocks enable row level security;
alter table public.match_reports enable row level security;

-- Participants always. Admins only while a report on this thread is open or
-- being reviewed -- access begins at the report and ends when it closes. The
-- privacy policy states exactly this, so the two must not drift.
create policy messages_select_participant_or_open_report on public.messages
  for select to authenticated using (
    public.owner_in_match(match_id)
    or (
      public.is_admin()
      and exists (
        select 1 from public.match_reports r
        where r.match_id = messages.match_id
          and r.status in ('open', 'reviewing')
      )
    )
  );

create policy messages_insert_participant on public.messages
  for insert to authenticated with check (
    public.owner_in_match(match_id)
    and sender_owner_id = auth.uid()
    and not public.match_is_blocked(match_id)
  );

-- No update or delete policy on messages, deliberately: a reported
-- conversation must not be editable after the fact.

create policy match_reads_select_own on public.match_reads
  for select to authenticated using (owner_id = auth.uid());
create policy match_reads_insert_own on public.match_reads
  for insert to authenticated with check (owner_id = auth.uid() and public.owner_in_match(match_id));
create policy match_reads_update_own on public.match_reads
  for update to authenticated using (owner_id = auth.uid());

create policy match_blocks_select_participant on public.match_blocks
  for select to authenticated using (public.owner_in_match(match_id));
create policy match_blocks_insert_own on public.match_blocks
  for insert to authenticated with check (
    blocker_owner_id = auth.uid() and public.owner_in_match(match_id)
  );
create policy match_blocks_delete_own on public.match_blocks
  for delete to authenticated using (blocker_owner_id = auth.uid());

create policy match_reports_select_own_or_admin on public.match_reports
  for select to authenticated using (reporter_owner_id = auth.uid() or public.is_admin());
create policy match_reports_insert_own on public.match_reports
  for insert to authenticated with check (
    reporter_owner_id = auth.uid() and public.owner_in_match(match_id)
  );
create policy match_reports_update_admin on public.match_reports
  for update to authenticated using (public.is_admin());
