create table public.owners (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.owners enable row level security;

create policy "owners_select_own" on public.owners
  for select using (auth.uid() = id);

create policy "owners_update_own" on public.owners
  for update using (auth.uid() = id);

create table public.breeds (
  id bigint generated always as identity primary key,
  name text not null unique
);

alter table public.breeds enable row level security;

create policy "breeds_select_all" on public.breeds
  for select to authenticated using (true);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.owners (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
