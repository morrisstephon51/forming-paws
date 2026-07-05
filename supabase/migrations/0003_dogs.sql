create type public.dog_sex as enum ('male', 'female');

create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  name text not null,
  breed_id bigint not null references public.breeds(id),
  sex public.dog_sex not null,
  birth_date date not null,
  weight_lbs numeric(5,1),
  temperament_notes text,
  created_at timestamptz not null default now()
);

alter table public.dogs enable row level security;

create policy "dogs_select_own" on public.dogs
  for select using (owner_id = auth.uid());

create policy "dogs_insert_own" on public.dogs
  for insert with check (owner_id = auth.uid());

create policy "dogs_update_own" on public.dogs
  for update using (owner_id = auth.uid());

create policy "dogs_delete_own" on public.dogs
  for delete using (owner_id = auth.uid());
