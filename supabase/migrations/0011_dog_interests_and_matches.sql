-- supabase/migrations/0011_dog_interests_and_matches.sql

create table public.dog_interests (
  id uuid primary key default gen_random_uuid(),
  expressing_dog_id uuid not null references public.dogs(id) on delete cascade,
  target_dog_id uuid not null references public.dogs(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint dog_interests_no_self check (expressing_dog_id <> target_dog_id),
  constraint dog_interests_unique unique (expressing_dog_id, target_dog_id)
);

alter table public.dog_interests enable row level security;

create policy "dog_interests_insert_own_verified" on public.dog_interests
  for insert with check (
    exists (select 1 from public.dogs d where d.id = expressing_dog_id and d.owner_id = auth.uid())
    and public.dog_is_baseline_verified(expressing_dog_id)
  );

create policy "dog_interests_select_involving_own" on public.dog_interests
  for select using (
    exists (select 1 from public.dogs d where d.id = expressing_dog_id and d.owner_id = auth.uid())
    or exists (select 1 from public.dogs d where d.id = target_dog_id and d.owner_id = auth.uid())
  );

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  dog_a_id uuid not null references public.dogs(id) on delete cascade,
  dog_b_id uuid not null references public.dogs(id) on delete cascade,
  matched_at timestamptz not null default now(),
  constraint matches_ordered check (dog_a_id < dog_b_id),
  constraint matches_unique unique (dog_a_id, dog_b_id)
);

alter table public.matches enable row level security;

create policy "matches_select_involving_own" on public.matches
  for select using (
    exists (select 1 from public.dogs d where d.id = dog_a_id and d.owner_id = auth.uid())
    or exists (select 1 from public.dogs d where d.id = dog_b_id and d.owner_id = auth.uid())
  );

-- Auto-create a match when both directions of interest exist. security
-- definer so the insert succeeds despite matches having no insert policy
-- (mirrors handle_new_user() in migration 0001).
create or replace function public.create_match_on_mutual_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.dog_interests
    where expressing_dog_id = new.target_dog_id
      and target_dog_id = new.expressing_dog_id
  ) then
    insert into public.matches (dog_a_id, dog_b_id)
    values (least(new.expressing_dog_id, new.target_dog_id), greatest(new.expressing_dog_id, new.target_dog_id))
    on conflict (dog_a_id, dog_b_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_dog_interest_created
  after insert on public.dog_interests
  for each row execute function public.create_match_on_mutual_interest();
