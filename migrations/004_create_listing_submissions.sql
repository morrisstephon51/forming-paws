-- Migration 004: create listing_submissions table
-- Stores dog listing requests submitted via list.html for admin review.
-- Run in Supabase SQL editor for project wyzcnkdonbdykidmcxvx

create table if not exists public.listing_submissions (
  id            uuid primary key default gen_random_uuid(),
  dog_name      text not null,
  breed         text not null,
  sex           char(1) not null check (sex in ('M', 'F')),
  age_years     numeric,
  weight_lbs    int,
  city          text,
  bio           text,
  health_docs   text[],          -- array of checked doc types
  owner_name    text,
  owner_email   text not null,
  status        text not null default 'pending_review'
                  check (status in ('pending_review', 'approved', 'needs_more_docs', 'rejected')),
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewer_note text
);

-- Only admins (service role) can read/write submissions — owners submit anonymously.
alter table public.listing_submissions enable row level security;

create policy "submissions_insert_public"
  on public.listing_submissions
  for insert
  using (true)
  with check (true);
