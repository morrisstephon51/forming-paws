-- supabase/migrations/0008_owner_location.sql
create extension if not exists postgis;

alter table public.owners
  add column location_point geography(Point, 4326),
  add column location_label text;
