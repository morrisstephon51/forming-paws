-- supabase/migrations/0031_fix_admin_health_doc_storage_and_codify_policies.sql
--
-- Three fixes, all of them things a previous migration left behind.
--
--   1. CRITICAL. storage.objects/health_docs_storage_owner_access is the THIRD
--      policy that inlines the frozen owners.is_admin lookup. 0026 found two,
--      fixed them, and recorded "the remaining 2 policies" -- it had scoped its
--      catalog sweep to the `public` schema, and this one is in `storage`. The
--      effect is that a console-granted admin can approve vet records they
--      cannot open.
--
--   2. dogs_select_admin and owners_select_admin are live in production but
--      appear in no migration file. Codified here so a database rebuilt from
--      supabase/migrations/ alone is not missing the admin console.
--
--   3. anon and authenticated hold TRUNCATE on every table this project owns in
--      public. TRUNCATE bypasses row triggers AND RLS, so it defeats 0028's and
--      0030's guards outright. Revoked, and the default ACL that keeps handing
--      it out is closed too.
--
-- Every statement is idempotent and the file is re-runnable end to end, per the
-- rule 0028 states: a migration that aborts halfway leaves a state no later
-- statement can repair, and the operator's only recourse is to re-run it.
-- Applying this to production is a no-op for fix 2 and a change for 1 and 3.
--
-- Live definitions restated below were captured with pg_policies /
-- information_schema.role_table_grants against project wyzcnkdonbdykidmcxvx on
-- 2026-09-09, not transcribed from a description of them.

-- ---------------------------------------------------------------------------
-- 1. THE ADMIN WHO CAN APPROVE WHAT THEY CANNOT READ
--
-- 0014 installs a trigger that raises whenever owners.is_admin changes while
-- auth.uid() is non-null, so no authenticated session can ever set that column.
-- The console does not try: it grants roles. An admin created through the
-- console therefore has a public.user_roles row and is_admin = false.
--
-- 0026 redefined public.is_admin() to resolve through has_role(), which repaired
-- every policy that CALLS the function. It also repointed the two policies that
-- inlined the column instead -- health_documents_admin_select_all and
-- health_documents_admin_update -- and its comment says those were "the
-- remaining 2". A catalog sweep across ALL schemas finds a third, here in
-- `storage`, and it is the one that matters most:
--
--   health_documents_admin_select_all  -> the admin CAN list every vet document
--   health_documents_admin_update      -> the admin CAN verify or reject it
--   health_docs_storage_owner_access   -> the admin CANNOT get the signed URL
--
-- So app/admin/review-queue/page.tsx renders a queue of documents with no
-- openable file behind any of them, and the only available actions are approve
-- and reject. The first console-granted admin would have been asked to make a
-- verification decision on evidence the database refused to show them, with no
-- error to explain why -- storage returns "not found", not "denied". Verified
-- health records are what gate matching and breeding on this platform, so a
-- rubber-stamped queue is not a cosmetic failure.
--
-- The fix is the same one 0026 applied to its two: replace the inlined lookup
-- with public.is_admin(), so there is exactly one definition of "is an admin"
-- in the database and the next role-system change reaches all of them.
--
-- ---------------------------------------------------------------------------
-- WHY `roles` STAYS {public} AND IS NOT NARROWED TO {authenticated}
--
-- The public-schema admin policies are {authenticated}; this one is {public},
-- and that difference is worth a sentence rather than a silent normalisation.
--
-- It is not a deliberate widening. 0005 and 0006 created all three health-docs
-- and dog-photos storage policies with no `to` clause at all, and a policy with
-- no `to` clause is TO PUBLIC. Its two siblings on the same table --
-- health_docs_storage_owner_insert and dog_photos_storage_owner_access -- are
-- {public} for exactly the same reason and are untouched by this migration.
--
-- Narrowing is declined for three reasons:
--
--   a. It would buy no access control. Beyond `authenticated`, the only roles
--      {public} reaches here that are subject to RLS at all are `anon` and
--      `authenticator` (storage.objects is owned by supabase_storage_admin and
--      is not FORCE ROW LEVEL SECURITY, so the owner is exempt; postgres,
--      service_role and supabase_admin all hold BYPASSRLS). For those roles
--      auth.uid() is null, and BOTH branches of this policy are anchored on
--      auth.uid(): the owner branch compares d.owner_id = auth.uid(), and
--      public.is_admin() -> has_role('admin') compares ur.owner_id = auth.uid().
--      Both yield an EXISTS over zero rows, i.e. false. anon matches no row
--      today and would match no row under {authenticated} either. The change is
--      cosmetic, not protective.
--
--   b. It would bundle an independently-risky change into a security fix. RLS on
--      storage.objects is evaluated under whatever role the storage service sets
--      from the JWT, and this migration has not enumerated every internal role
--      that path can use. {public} is invariant under that uncertainty;
--      {authenticated} is not. The entire point of this fix is that an admin is
--      currently denied a document -- trading that denial for a possibly
--      different denial is the wrong trade to make blind.
--
--   c. Changing one of three identically-shaped sibling policies implies a
--      distinction that does not exist. If the `to` clauses should be tightened,
--      that is a sweep across all storage policies with its own verification,
--      not a rider on this one.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MEANS FOR AN OWNER'S *REMOVED* DOG (documented, NOT changed)
--
-- The owner branch below reads public.dogs in a subquery. PostgreSQL applies
-- row-level security to tables referenced inside a policy's USING expression, so
-- that subquery runs under the CALLER's own RLS, and 0028 narrowed
-- dogs_select_own to `owner_id = auth.uid() and removed_at is null`.
--
-- Consequence: once an admin removes a dog, its owner can no longer see the dog
-- row, so this policy's owner branch is false for that dog, so the owner loses
-- the signed URL for their own health documents on it. This is transitive and
-- unstated at both ends -- neither dogs_select_own nor this policy mentions the
-- other -- which is exactly why it is written down here. 0028's own header
-- documents the identical effect for dog_photos and dog_photos_storage_owner_access.
--
-- It is coherent rather than accidental: health_documents_select_own reaches the
-- owner through the same subquery on public.dogs, so a removed dog's owner has
-- already lost the health_documents ROWS. Losing the FILES too keeps the two in
-- agreement instead of leaving a listable record with an unreachable document.
-- Nothing is destroyed -- removal is soft, and admin_restore_dog reverses all of
-- it -- and the admin branch is deliberately unfiltered (dogs_select_admin has
-- no removed_at predicate), so a moderator can still read the documents of a
-- removed dog, which is the whole point of being able to review one.
--
-- This migration does NOT change that behaviour. It records it.
-- ---------------------------------------------------------------------------

-- The owner branch is preserved EXACTLY as 0006 wrote it and as pg_policies
-- reports it today, including the `objects.name` qualification that 0006 exists
-- to fix (an unqualified `name` resolves to public.dogs.name inside this
-- subquery and silently matches nothing). Only the admin branch changes.
--
-- `drop policy` on storage.objects requires ownership of the table, which
-- belongs to supabase_storage_admin. Migrations 0006 and 0028 both did exactly
-- this against this project and both results are live, so the applying role has
-- the necessary rights here; this is the established pattern, not a new one.
drop policy if exists "health_docs_storage_owner_access" on storage.objects;
create policy "health_docs_storage_owner_access" on storage.objects
  for select using (
    bucket_id = 'health-docs'
    and (
      exists (
        select 1 from public.dogs d
        where d.owner_id = auth.uid()
          and (storage.foldername(objects.name))[1] = d.id::text
      )
      or public.is_admin()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. TWO POLICIES THAT EXIST ONLY IN PRODUCTION
--
-- dogs_select_admin and owners_select_admin are live, but no `create policy` for
-- either appears anywhere in supabase/migrations/. dogs_select_admin was most
-- likely created by hand alongside the admin console; owners_select_admin
-- corresponds to the `admin_member_list_access` entry that sits in
-- supabase_migrations.schema_migrations with no file behind it.
--
-- On a database rebuilt from the migration files alone, both are simply absent,
-- and the admin console degrades silently rather than loudly:
--
--   /admin/dogs      renders empty -- an admin sees only dogs they own
--   /admin/users     shows only the acting admin
--   /admin/audit-log shows every actor as unknown (the actor join is on owners)
--   admin_restore_dog is unreachable: a removed dog cannot be found to restore
--   supabase/tests/0028_admin_dog_management_assertions.sql fails its
--     "dogs_select_admin is missing" check
--
-- Restated below from the live definitions. `drop policy if exists` then
-- `create policy` makes this a no-op against production (the recreated policy is
-- byte-identical in meaning) and a repair against a rebuilt database.
--
-- One deviation from the live text, and it is a no-op: pg_policies renders the
-- qual as `is_admin()` because public is on the search_path. It is written as
-- `public.is_admin()` here, matching how 0026 and 0028 write every other call.

-- dogs_select_admin is deliberately UNFILTERED -- no removed_at predicate. 0028
-- depends on this: an admin must keep seeing a removed dog or admin_restore_dog
-- can never be reached, and 0028's assertion script checks for exactly that.
drop policy if exists "dogs_select_admin" on public.dogs;
create policy "dogs_select_admin" on public.dogs
  for select to authenticated using (public.is_admin());

-- Without this, /admin/users lists only the acting admin and every audit-log
-- actor resolves to nothing. It is also what makes 0026's user_roles admin embed
-- useful: reading everyone's grants is pointless if the owners rows they hang
-- off are invisible.
drop policy if exists "owners_select_admin" on public.owners;
create policy "owners_select_admin" on public.owners
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. TRUNCATE
--
-- anon and authenticated hold TRUNCATE on all 18 tables this project owns in
-- public. TRUNCATE fires no row triggers and consults no row-level security, so
-- it steps straight past both of this week's guards: 0028's
-- prevent_non_admin_dog_removal_change trigger and 0030's
-- prevent_removed_dog_deletion trigger are row-level and simply never run, and
-- every dogs_* policy is irrelevant to a statement that examines no row.
--
-- Not exploitable by a member holding only a JWT: PostgREST emits no TRUNCATE,
-- so there is no request shape that reaches it. It is filed under the category
-- that already produced one live incident on this project -- 0029, where a
-- default-ACL grant to anon nobody had looked at made grant_role callable
-- without a session. The lesson recorded there is that "not currently reachable"
-- is a property of today's client, not of the grant.
--
-- Where it came from: this project has a pg_default_acl entry (schema public,
-- objtype 'r', grantor postgres) granting arwdDxtm -- the D is TRUNCATE -- to
-- anon, authenticated and service_role on every newly created table. That is the
-- same mechanism 0010 and 0029 document for functions. So this is not a mistake
-- in any one migration; every `create table` in public has been picking it up
-- automatically since the first one.
--
-- Which tables are covered, and which are not:
--
--   COVERED -- all 18 base tables in `public` owned by postgres: audit_log,
--     breeds, contact_messages, dog_interests, dog_photos, dogs,
--     health_documents, litters, match_blocks, match_reads, match_reports,
--     matches, messages, owners, puppy_inquiries, roles, user_roles, waitlist.
--     Enumerated dynamically below rather than listed, so a table this repo adds
--     later is covered by a re-run and so the statement cannot silently miss one.
--
--   NOT COVERED -- public.dogs_browsable. It is a view. TRUNCATE cannot be
--     executed against a view at all, so the reasoning above does not apply to
--     it; its ACL bit is inert.
--
--   NOT COVERED -- public.spatial_ref_sys, and storage.objects / storage.buckets
--     / storage.buckets_analytics. anon and authenticated hold TRUNCATE on all
--     four, and on the storage tables that is genuinely worth worrying about.
--     But they are owned by supabase_admin and supabase_storage_admin, and the
--     grants were made BY those roles. REVOKE only removes privileges granted by
--     the revoking role, and postgres holds no grant option on spatial_ref_sys,
--     so a revoke issued here would emit a warning and remove nothing -- a
--     migration that appears to fix something and does not. These are
--     platform-managed schemas; closing them is a Supabase-side action, and it
--     is called out in the task report rather than faked here.
--
-- Nothing needs TRUNCATE. PostgREST cannot issue it, and every destructive
-- operation this app performs goes through a security-definer function or a
-- soft-delete column.

do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and pg_get_userbyid(c.relowner) = 'postgres'
    order by c.relname
  loop
    execute format('revoke truncate on table public.%I from anon, authenticated', r.relname);
  end loop;
end $$;

-- Without this the fix decays: the default ACL above re-grants TRUNCATE to anon
-- and authenticated on the very next `create table` in public, and the next
-- migration silently reopens what this one closed.
--
-- Scope is deliberately minimal -- it removes TRUNCATE and nothing else, leaving
-- every other default privilege (SELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER/
-- MAINTAIN) exactly as it is, because PostgREST's whole model depends on them.
--
-- The implicit "for role <current_user>" form is used on purpose. Default ACLs
-- are keyed on the role that CREATES the object; migrations here run as postgres,
-- which is the grantor of the entry being closed. Writing `for role postgres`
-- explicitly would fail outright if this file were ever applied by a role that
-- is not postgres and not a member of it. Revoking a privilege that is not in a
-- default ACL -- or when no such entry exists at all, as on a freshly built local
-- database -- is a silent no-op, so this is safe to re-run and safe on a rebuild.
alter default privileges in schema public
  revoke truncate on tables from anon, authenticated;
