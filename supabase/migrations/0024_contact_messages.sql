-- Messages from the public contact form.
--
-- Stored rather than emailed: the site's outbound mail has already failed once
-- in production, and a contact form that silently drops what someone wrote is
-- worse than no contact form. The row lands here whatever the mail provider is
-- doing, and /admin/messages is where the team reads it.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references public.owners(id)
);

alter table public.contact_messages enable row level security;

-- Anyone may write, signed in or not — the form is on public pages. The length
-- bounds live in the policy rather than in the app, because the app is not the
-- only thing that can reach PostgREST; without them a single request could park
-- an unbounded blob in the table. `handled_*` is staff-only state, so an insert
-- that tries to set it is refused rather than silently accepted.
create policy contact_messages_insert_anyone on public.contact_messages
  for insert to anon, authenticated
  with check (
    length(name) between 1 and 100
    and length(email) between 3 and 254
    and length(message) between 1 and 5000
    and handled_at is null
    and handled_by is null
  );

-- Nobody reads them back but admins. Notably there is no select policy for the
-- author: without one, an anon visitor cannot read even their own message, which
-- is what stops the table being a public inbox for everyone else's.
create policy contact_messages_select_admin on public.contact_messages
  for select to authenticated
  using (public.is_admin());

create policy contact_messages_update_admin on public.contact_messages
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create index contact_messages_unhandled_idx
  on public.contact_messages (created_at desc)
  where handled_at is null;
