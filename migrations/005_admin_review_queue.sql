-- Migration 005: admin review queue
-- Enables authenticated admins to read and update listing_submissions.
-- Run in Supabase SQL editor for project wyzcnkdonbdykidmcxvx
-- After running, add Stef's Supabase Auth email:
--   insert into public.admin_users(email) values ('morrisstephon51@gmail.com');

-- Table: tracks which Supabase Auth emails have admin access
create table if not exists public.admin_users (
  email text primary key
);

-- Lock down admin_users: RLS enabled, no client policies → default-deny.
-- Only service_role (Supabase dashboard / server-side) can insert/delete rows.
-- This prevents any authenticated user from self-granting admin access via the anon key.
alter table public.admin_users enable row level security;

-- Policy: authenticated admins can read all listing submissions
create policy "admins_select_submissions"
  on public.listing_submissions
  for select
  using (
    exists (
      select 1 from public.admin_users
      where email = auth.email()
    )
  );

-- Policy: authenticated admins can update status + reviewer_note
create policy "admins_update_submissions"
  on public.listing_submissions
  for update
  using (
    exists (
      select 1 from public.admin_users
      where email = auth.email()
    )
  )
  with check (
    exists (
      select 1 from public.admin_users
      where email = auth.email()
    )
  );
