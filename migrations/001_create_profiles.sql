-- Migration 001: create profiles table
-- Run in Supabase SQL editor for project wyzcnkdonbdykidmcxvx

create table if not exists public.profiles (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  city       text,
  created_at timestamptz default now()
);
