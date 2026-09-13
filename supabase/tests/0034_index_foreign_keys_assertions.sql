-- supabase/tests/0034_index_foreign_keys_assertions.sql
--
-- Run against a database that has migration 0034 applied. Read-only checks
-- inside a transaction that ends in `rollback`.
--
-- The check is by property, not by name: every foreign key in public must have
-- an index whose leading columns are exactly the key's columns. That is the same
-- rule Supabase's unindexed_foreign_keys advisor applies, so a key added later
-- without an index fails here too.

begin;

do $$
declare
  missing text;
begin
  select string_agg(c.conrelid::regclass::text || '.' || c.conname, ', '
                    order by c.conrelid::regclass::text, c.conname)
    into missing
  from pg_constraint c
  where c.contype = 'f'
    and c.connamespace = 'public'::regnamespace
    and not exists (
      select 1 from pg_index i
      where i.indrelid = c.conrelid
        and array_to_string((i.indkey::int2[])[0:array_length(c.conkey, 1) - 1], ',')
          = array_to_string(c.conkey, ',')
    );

  if missing is not null then
    raise exception 'FAIL 1: foreign keys without a covering index: %', missing;
  end if;
  raise notice 'PASS 1: every foreign key in public has a covering index';
end $$;

do $$
declare
  expected text[] := array[
    'audit_log_actor_id_idx', 'contact_messages_handled_by_idx', 'dog_interests_target_dog_id_idx',
    'dog_photos_dog_id_idx', 'dogs_breed_id_idx', 'dogs_litter_id_idx', 'dogs_removed_by_idx',
    'health_documents_dog_id_idx', 'litters_breeder_id_idx', 'litters_dam_id_idx', 'litters_sire_id_idx',
    'match_blocks_blocker_owner_id_idx', 'match_reads_owner_id_idx', 'match_reports_match_id_idx',
    'match_reports_reporter_owner_id_idx', 'matches_dog_b_id_idx', 'messages_sender_owner_id_idx',
    'puppy_inquiries_buyer_id_idx', 'user_roles_granted_by_idx', 'user_roles_role_id_idx'
  ];
  absent text;
begin
  select string_agg(name, ', ') into absent
  from unnest(expected) as name
  where to_regclass('public.' || name) is null;

  if absent is not null then
    raise exception 'FAIL 2: indexes from 0034 not found: %', absent;
  end if;
  raise notice 'PASS 2: all 20 indexes from 0034 exist';
end $$;

rollback;
