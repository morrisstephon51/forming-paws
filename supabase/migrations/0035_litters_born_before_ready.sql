-- supabase/migrations/0035_litters_born_before_ready.sql
--
-- Issue #70 flagged the litter born_on/ready_on gap as "client zod no-op +
-- no DB CHECK". The client half is handled by the zod refinement in
-- lib/validators/litter.ts (PR #71), but the app is not the only thing that
-- can insert: PostgREST is reachable directly, which is exactly why this
-- table already DB-enforces its other invariants -- litters_sire_dam_distinct
-- in 0026, and dogs_listed_price_non_negative for the sibling price field.
-- A litter cannot be ready for its new homes before it was born, so
-- born_on <= ready_on is a pure relation between two columns of the same row:
-- the clean, immutable shape a CHECK is meant for.
--
-- Scope note: "born_on not in the future" is deliberately NOT added here. It
-- depends on the current date, so it is not an immutable expression and does
-- not belong in a CHECK (it would be evaluated only at write time, never
-- re-validated). That guard stays in the app layer alongside the puppy/dog
-- birth-date guards (lib/dogBirthDate). This migration adds only the
-- time-independent relation between the two columns.
--
-- NULL-permissive on purpose: either date may be unknown at creation
-- ("if known" in the form), and a CHECK passes on NULL, so an
-- expected-but-unborn or not-yet-scheduled litter is unaffected.
--
-- Apply after confirming no existing row violates it:
--   select id, born_on, ready_on from public.litters
--   where born_on is not null and ready_on is not null and born_on > ready_on;

alter table public.litters
  add constraint litters_born_before_ready
  check (born_on is null or ready_on is null or born_on <= ready_on);
