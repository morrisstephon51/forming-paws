-- supabase/migrations/0034_index_foreign_keys.sql
--
-- Index the 20 foreign keys in public that have no index leading with their
-- columns, as flagged by Supabase's performance advisor (unindexed_foreign_keys)
-- on 2026-09-13.
--
-- Nothing is slow today: the largest of these tables holds a few dozen rows. The
-- cost of a missing foreign-key index grows with the data, in two places:
--   * joins and filters on the column (dog photos by dog, messages by sender,
--     a litter's dam and sire) fall back to a sequential scan;
--   * deleting or re-keying a parent row makes Postgres scan the whole child
--     table to check the constraint, holding locks while it does.
--
-- Plain CREATE INDEX, not CONCURRENTLY: a migration runs inside a transaction,
-- which CONCURRENTLY cannot, and at this size each build takes milliseconds.
-- IF NOT EXISTS keeps a re-run harmless. Names follow the existing
-- <table>_<column>_idx convention.

create index if not exists audit_log_actor_id_idx on public.audit_log (actor_id);
create index if not exists contact_messages_handled_by_idx on public.contact_messages (handled_by);
create index if not exists dog_interests_target_dog_id_idx on public.dog_interests (target_dog_id);
create index if not exists dog_photos_dog_id_idx on public.dog_photos (dog_id);
create index if not exists dogs_breed_id_idx on public.dogs (breed_id);
create index if not exists dogs_litter_id_idx on public.dogs (litter_id);
create index if not exists dogs_removed_by_idx on public.dogs (removed_by);
create index if not exists health_documents_dog_id_idx on public.health_documents (dog_id);
create index if not exists litters_breeder_id_idx on public.litters (breeder_id);
create index if not exists litters_dam_id_idx on public.litters (dam_id);
create index if not exists litters_sire_id_idx on public.litters (sire_id);
create index if not exists match_blocks_blocker_owner_id_idx on public.match_blocks (blocker_owner_id);
create index if not exists match_reads_owner_id_idx on public.match_reads (owner_id);
create index if not exists match_reports_match_id_idx on public.match_reports (match_id);
create index if not exists match_reports_reporter_owner_id_idx on public.match_reports (reporter_owner_id);
create index if not exists matches_dog_b_id_idx on public.matches (dog_b_id);
create index if not exists messages_sender_owner_id_idx on public.messages (sender_owner_id);
create index if not exists puppy_inquiries_buyer_id_idx on public.puppy_inquiries (buyer_id);
create index if not exists user_roles_granted_by_idx on public.user_roles (granted_by);
create index if not exists user_roles_role_id_idx on public.user_roles (role_id);
