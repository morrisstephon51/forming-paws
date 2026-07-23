-- Lets an owner withdraw an outgoing interest before it becomes a mutual
-- match. Also unblocks e2e re-runnability: dog_interests_unique otherwise
-- makes a prior test run's interest permanent, since nothing could
-- previously delete it.
create policy "dog_interests_delete_own" on public.dog_interests
  for delete using (
    exists (select 1 from public.dogs d where d.id = expressing_dog_id and d.owner_id = auth.uid())
  );
