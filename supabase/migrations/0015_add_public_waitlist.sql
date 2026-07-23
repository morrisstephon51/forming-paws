-- Documents a migration that was already applied live on 2026-07-20
-- (version 20260720190859, chronologically between 0007 and 0008) but never
-- had a corresponding file committed to this repo — found during a
-- whole-codebase review that checked repo migrations against live state and
-- found them diverged. Not re-applied here (already live); this file exists
-- so re-provisioning from the repo reproduces the real schema. No app code
-- currently reads or writes this table (grep confirms), so it's stale
-- infrastructure — kept for reproducibility, not because anything depends on
-- it. The always-true anon INSERT is a common (if spam-prone) pattern for a
-- pre-launch email waitlist.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  city text,
  dog_breed text,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

create policy "public can join waitlist" on public.waitlist
  for insert to anon with check (true);
