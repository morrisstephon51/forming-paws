-- Critical fix: owners could self-issue `status = 'verified'` (or set
-- reviewed_at/reviewer_notes) directly via PostgREST, bypassing admin
-- review entirely — confirmed live during a whole-codebase security
-- review. The app's own upload route never sets these fields (relying on
-- the column default), but nothing in the database enforced that. There is
-- no owner UPDATE policy on this table, so restricting INSERT is
-- sufficient to close the hole — an owner can never reach verified status
-- except through admin review (health_documents_admin_update).
drop policy "health_documents_insert_own" on public.health_documents;
create policy "health_documents_insert_own" on public.health_documents
  for insert with check (
    exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid())
    and status = 'pending_review'
    and reviewed_at is null
    and reviewer_notes is null
  );
