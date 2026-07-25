-- Migration 003: Enable RLS and add public read policy on dogs table
-- Without this, the anonymous publishable-key fetch in app.js returns 0 rows
-- even after seeding, and the app silently falls back to static data.

alter table public.dogs enable row level security;

-- Allow anyone (including anonymous visitors) to read dog listings
create policy "dogs_public_read"
  on public.dogs
  for select
  using (true);

-- Enable RLS on profiles (private — owner access only, via auth.uid())
alter table public.profiles enable row level security;

create policy "profiles_owner_read"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles_owner_write"
  on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
