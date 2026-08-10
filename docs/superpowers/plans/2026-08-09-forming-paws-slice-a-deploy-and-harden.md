# Forming Paws Slice A — Deploy & Harden Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the Next.js app on `app.theplugai.xyz` so the 5 email-confirmed members stuck on the static site can reach health-document upload and matching, and close the defect backlog that would otherwise ship with it.

**Architecture:** Marketing stays on GitHub Pages at `theplugai.xyz`; the app deploys to Vercel at `app.theplugai.xyz`. Both share one Supabase project, so existing accounts and dogs require no migration. Superseded static pages become redirects rather than deletions, so printed QR codes keep working.

**Tech Stack:** Next.js 15 (App Router) · React 19 · Supabase (Postgres + Auth + Storage) · Tailwind 3 · Vitest · Playwright · Vercel · GitHub Pages

**Spec:** `docs/superpowers/specs/2026-08-09-forming-paws-deploy-and-harden-design.md`

## Global Constraints

- Supabase project ref: `wyzcnkdonbdykidmcxvx`. Do not create or point at another project.
- App env vars are exactly two: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Do not introduce a service-role key into the app — RLS is the security boundary.
- Migrations are sequential and immutable. The next number is `0019`. Never edit a committed migration.
- Vercel Hobby tier, no paid add-ons. A billing cap ended the previous hosting attempt.
- Every task ends with lint, typecheck, and tests green: `npx tsc --noEmit` · `npm run lint` · `npm test`.
- Static-site files live on the **`gh-pages`** branch, not `main`. They are plain HTML/JS with no build step.
- Task 1 (PR #16) must merge before Task 7. Without `getRequestOrigin`, production auth redirects break.

---

### Task 1: Recover stranded auth work — ✅ DONE (PR #16)

Auth fixes had sat uncommitted for two days on `fix/upload-redirect`, a branch whose own PR had already merged. Moved to `fix/email-confirm-flow` branched from `origin/main`.

The original branch was *behind* `main`: committing from it would have regressed the `303` on the upload redirects merged in #14. Without `303`, a POST redirect re-issues the POST.

Delivered `/auth/confirm` (verifyOtp + token hash, so links work cross-device), `lib/auth/redirects.ts` (`getRequestOrigin`, `safeRedirectPath`, `loginUrlWithError`), `HashSessionRecovery`, and resend paths on `/signup` and `/login`.

**Verified:** `tsc` exit 0 · 27/27 tests · build clean, `/auth/confirm` in the route table.

---

### Task 2: Restore lint coverage and add CI — ✅ DONE (PR #17)

`npm run lint` had failed outright since the ESLint 9 upgrade — v9 needs flat config and there was none, so the project ran with **zero** lint coverage. The only workflow on `main` was a manual `workflow_dispatch` static-site publish; nothing verified a push.

Delivered `eslint.config.mjs` (bridges eslintrc-format `eslint-config-next` via `FlatCompat`), `@eslint/eslintrc` as an explicit devDependency, named exports in `eslint.config.mjs` and `postcss.config.mjs`, and `.github/workflows/ci.yml` running tsc/lint/test.

**Verified** with the exact CI sequence locally: tsc exit 0 · lint 0 problems · 27/27 tests.

---

### Task 3: Tighten dog-photo visibility (migration 0019)

**Files:**
- Create: `supabase/migrations/0019_restrict_dog_photo_visibility.sql`

**Interfaces:**
- Consumes: `public.dogs_browsable` view (columns confirmed against the live schema: `id, owner_id, name, breed_id, breed_name, sex, birth_date, created_at`); `authenticated` already holds `SELECT` on it via migration 0010.
- Produces: nothing consumed by later tasks.

**Why two policies, not one.** `dog_photos_select_browsable` on the table is `USING (true)`, leaking every photo *row*. `dog_photos_storage_browsable_select` on `storage.objects` is `bucket_id = 'dog-photos'`, serving every photo *file*. Fixing only the table still leaves the images fetchable by any signed-in user who guesses a path. Both must change for the fix to mean anything.

**Do not touch `dog_photos_select_own` or `dog_photos_storage_owner_access`.** Those are what let an owner see their own dog's photos while the dog is still unverified — i.e. during upload, before it appears in `dogs_browsable`. Policies are OR'd, so tightening the browsable pair alone is sufficient and safe. Verified present in the live database.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0019_restrict_dog_photo_visibility.sql
--
-- Both "browsable" photo policies were effectively public-to-any-signed-in-user:
-- the table policy was USING (true) and the storage policy matched the whole
-- bucket. Together they let any authenticated account enumerate and download
-- every dog photo, including photos of dogs that are unverified and therefore
-- deliberately absent from dogs_browsable.
--
-- The owner-scoped policies (dog_photos_select_own, dog_photos_storage_owner_access)
-- are intentionally left alone: they are what lets an owner see their own dog's
-- photos before that dog becomes browsable. Policies are OR'd.

drop policy if exists dog_photos_select_browsable on public.dog_photos;

create policy dog_photos_select_browsable
  on public.dog_photos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.dogs_browsable b
      where b.id = dog_photos.dog_id
    )
  );

drop policy if exists "dog_photos_storage_browsable_select" on storage.objects;

create policy "dog_photos_storage_browsable_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'dog-photos'
    and exists (
      select 1
      from public.dogs_browsable b
      where b.id::text = (storage.foldername(objects.name))[1]
    )
  );
```

The `storage.foldername(objects.name)[1]` idiom matches the existing owner policy. Upload paths are written as `${dogId}/${uuid}.${ext}` by `app/api/upload/photo/route.ts`, so segment 1 is the dog id.

- [ ] **Step 2: Capture the pre-fix behaviour**

Run via the Supabase MCP `execute_sql`:

```sql
select count(*) as visible_to_any_authenticated from public.dog_photos;
```

Record the number. This is the count that must shrink (or stay equal only if every dog is browsable).

- [ ] **Step 3: Apply the migration**

Apply with the Supabase MCP `apply_migration`, name `restrict_dog_photo_visibility`, using the SQL from Step 1.

- [ ] **Step 4: Verify a non-owner sees only browsable dogs' photos**

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}';

select count(*) as rows_visible_to_stranger from public.dog_photos;

select count(*) as expected
from public.dog_photos p
where exists (select 1 from public.dogs_browsable b where b.id = p.dog_id);
```

Expected: `rows_visible_to_stranger` equals `expected`. The fake `sub` owns no dogs, so the owner policy contributes nothing.

- [ ] **Step 5: Verify an owner still sees their own unverified dog's photos**

```sql
set local role authenticated;
set local request.jwt.claims = json_build_object(
  'sub', (select owner_id::text from public.dogs order by created_at limit 1),
  'role', 'authenticated'
)::text;

select count(*) from public.dog_photos;
```

Expected: at least the photo count for that owner's dogs. A zero here means the owner policy was broken — stop and fix before continuing.

- [ ] **Step 6: Confirm the advisor finding clears**

Run the Supabase MCP `get_advisors` with `type: security`. Expected: no finding naming `dog_photos`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0019_restrict_dog_photo_visibility.sql
git commit -m "fix(rls): restrict dog photo rows and files to browsable dogs"
```

---

### Task 4: Show verification status on the app dashboard

**Files:**
- Create: `app/dashboard/dogLabel.ts`
- Modify: `app/dashboard/page.tsx`
- Test: `tests/unit/dashboard-verification.test.ts` (create)

**Interfaces:**
- Consumes: `supabase.rpc('dog_is_baseline_verified', { p_dog_id })` → `boolean`. Already used in `app/dogs/[id]/page.tsx:56` and `app/matches/page.tsx:73`.
- Produces: `dogLabel.ts` exports `dogListLabel(name: string, sex: string, isVerified: boolean): string`.

**Why the helper gets its own file.** `page.tsx` is a Server Component that imports `next/navigation` at module scope. Importing it from a Vitest jsdom run drags that machinery in and fails. This mirrors the existing precedent in this repo: `locationSchema` was pulled out to `lib/validators/location.ts` for exactly this reason.

**Why this is in scope.** Task 6 redirects `home.html` to `/dashboard`. `home.html` currently shows breed, age, and a status pill; `/dashboard` shows only name and sex. Without this, the redirect is a downgrade for every existing member.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/dashboard-verification.test.ts
import { describe, it, expect } from 'vitest'
import { dogListLabel } from '@/app/dashboard/dogLabel'

describe('dogListLabel', () => {
  it('marks a verified dog', () => {
    expect(dogListLabel('Luna', 'female', true)).toBe('Luna — female · ✓ Health verified')
  })

  it('marks an unverified dog as pending', () => {
    expect(dogListLabel('Duke', 'male', false)).toBe('Duke — male · Verification pending')
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/dashboard-verification.test.ts`
Expected: FAIL — `dogListLabel` is not exported.

- [ ] **Step 3: Add the helper and wire the RPC**

Create `app/dashboard/dogLabel.ts`:

```ts
/** Kept out of page.tsx so it is importable from a jsdom test run. */
export function dogListLabel(name: string, sex: string, isVerified: boolean): string {
  return `${name} — ${sex} · ${isVerified ? '✓ Health verified' : 'Verification pending'}`
}
```

In `app/dashboard/page.tsx`, add to the imports:

```tsx
import { dogListLabel } from './dogLabel'
```

Replace the dogs query and list with:

```tsx
  const { data: dogs, error } = await supabase
    .from('dogs')
    .select('id, name, sex, birth_date, breeds(name)')
    .eq('owner_id', userData.user.id)

  if (error) throw error

  const dogsWithStatus = await Promise.all(
    (dogs ?? []).map(async (dog) => {
      const { data: verified } = await supabase.rpc('dog_is_baseline_verified', {
        p_dog_id: dog.id,
      })
      return { ...dog, isVerified: !!verified }
    })
  )
```

and in the JSX:

```tsx
      <ul className="mt-6 flex flex-col gap-3">
        {dogsWithStatus.map((dog) => (
          <li key={dog.id}>
            <Link href={`/dogs/${dog.id}`} className="block border p-4 rounded hover:bg-gray-50">
              {dogListLabel(dog.name, dog.sex, dog.isVerified)}
            </Link>
          </li>
        ))}
        {dogsWithStatus.length === 0 && <p className="text-gray-500">No dogs yet.</p>}
      </ul>
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/unit/dashboard-verification.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the full gate**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: exit 0 · 0 lint problems · 29/29 tests.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/dogLabel.ts app/dashboard/page.tsx tests/unit/dashboard-verification.test.ts
git commit -m "feat(dashboard): show baseline health verification per dog"
```

---

### Task 5: Deploy to Vercel and attach the domain

**Files:** none in this repo — `vercel.json` on `main` already pins `{"framework": "nextjs"}`.

**Prerequisite:** PR #16 must be merged. `getRequestOrigin` reads `x-forwarded-host`; without it, every redirect built behind Vercel's proxy points at an internal host the user cannot reach.

- [ ] **Step 1: Inspect the existing Vercel project**

Use the Vercel MCP `list_projects`, then `get_project` for `forming-paws`. Determine whether it builds this repo's `main` or is pinned to static output. Repurpose if it can build `main`; otherwise create a new project.

- [ ] **Step 2: Set environment variables**

Set for Production and Preview:

```
NEXT_PUBLIC_SUPABASE_URL=https://wyzcnkdonbdykidmcxvx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the publishable key from .env.local>
```

Both are publishable client-side values. Do not add a service-role key.

- [ ] **Step 3: Confirm no paid add-ons**

Verify the project is on Hobby with no add-ons before triggering a build. A billing cap ended the previous hosting attempt; this is the single highest risk in the slice.

- [ ] **Step 4: Deploy and smoke-test the `.vercel.app` URL first**

```bash
for p in / /login /signup; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' https://<project>.vercel.app$p)"
done
```

Expected: `200` for all three. Test here **before** DNS, so a failure isn't confused with propagation.

- [ ] **Step 5: [FOUNDER] Add the DNS record**

In GoDaddy, for `theplugai.xyz`: add a `CNAME` record, host `app`, pointing at the target Vercel supplies (typically `cname.vercel-dns.com`). Then attach `app.theplugai.xyz` in the Vercel project's Domains settings.

- [ ] **Step 6: [FOUNDER] Add the Supabase redirect URL**

Supabase dashboard → Authentication → URL Configuration → Redirect URLs, add:

```
https://app.theplugai.xyz/**
```

**Skipping this breaks confirmation emails for every new signup.**

- [ ] **Step 7: [FOUNDER] Enable leaked-password protection**

Supabase dashboard → Authentication → Policies → enable leaked-password protection (checks against HaveIBeenPwned). Clears the outstanding advisor warning.

- [ ] **Step 8: Verify the deployment end to end**

```bash
for p in / /login /signup /dashboard; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' https://app.theplugai.xyz$p)"
done
```

Expected: `200` for `/`, `/login`, `/signup`. `/dashboard` returns `307` to `/login` when signed out — that is correct, not a failure.

- [ ] **Step 9: Verify an existing member's data appears**

Sign in at `https://app.theplugai.xyz/login` using `E2E_FIXTURE_EMAIL` / `E2E_FIXTURE_PASSWORD` from `.env.local`. Expected: "Fixture Dog A" listed on `/dashboard` with a verification label from Task 4.

- [ ] **Step 10: Verify the signup email round-trip**

Sign up with one fresh address. Expected: the emailed link points at `app.theplugai.xyz/auth/confirm?token_hash=…`, and following it lands on `/dashboard` signed in.

Use **one** address. The Supabase free tier rate-limits signup emails per hour.

---

### Task 6: Point the static site at the app

**Files (all on the `gh-pages` branch):**
- Modify: `index.html`, `app.html`
- Replace: `join.html`, `login.html`, `home.html`, `confirm.html`

**Prerequisite:** Task 5 complete and `app.theplugai.xyz` returning 200. Redirecting to a domain that does not resolve strands every member.

Work on `gh-pages` in a separate worktree so `main` stays checked out:

```bash
git worktree add ../forming-paws-ghpages gh-pages
```

- [ ] **Step 1: Fix the stale-session bounce in `index.html`**

Replace the inline script in `<head>`:

```html
<script>
// Signed-in members skip the marketing page and land on the app. Only redirect
// on a session that could still be valid -- an expired one with no refresh
// token used to bounce the visitor to the dashboard and straight back to login.
try {
  var fps = JSON.parse(localStorage.getItem("fp_session") || "null");
  if (fps && fps.access_token) {
    if (fps.expires_at > Date.now() / 1000 || fps.refresh_token) {
      location.replace("https://app.theplugai.xyz/dashboard");
    } else {
      localStorage.removeItem("fp_session");
    }
  }
} catch (e) {}
</script>
```

- [ ] **Step 2: Repoint the marketing CTAs in `index.html`**

Replace every `href="join.html"` with `href="https://app.theplugai.xyz/signup"` and `href="login.html"` with `href="https://app.theplugai.xyz/login"`. Leave `app.html` links alone — Step 5 handles that page.

- [ ] **Step 2b: Add the sign-in field to the marketing landing**

Requested 2026-08-09. The field lives on the landing page, but **credentials never do** — it collects an email and hands off to the app, which is the only thing that sees a password. That keeps the vanilla-JS auth copy count at zero rather than adding a sixth.

The app side is already built (PR #21): `/login` and `/` both accept `?email=` and prefill it via `safeEmailParam`.

Put it in the hero, below the existing CTA row, rather than in the nav — the nav has five items already and this would collapse badly on mobile. In `index.html`, after the `.hero-cta` div:

```html
    <form class="hero-signin" id="heroSignin">
      <label for="heroEmail">Already a member?</label>
      <input type="email" id="heroEmail" placeholder="you@example.com" aria-label="Your email" required>
      <button type="submit" class="btn btn-ghost btn-sm">Sign In</button>
    </form>
```

with this script alongside the existing waitlist script:

```html
<script>
document.getElementById("heroSignin").addEventListener("submit", function (e) {
  e.preventDefault();
  var email = document.getElementById("heroEmail").value.trim();
  // The app owns authentication. This only carries the address across.
  location.href = "https://app.theplugai.xyz/login" +
    (email ? "?email=" + encodeURIComponent(email) : "");
});
</script>
```

and this styling in `styles.css`:

```css
.hero-signin{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:18px;font-size:.9rem}
.hero-signin label{font-weight:700;opacity:.9}
.hero-signin input{padding:9px 12px;border-radius:8px;border:1.5px solid var(--line);font-size:.9rem;min-width:210px}
@media (max-width:520px){.hero-signin input{flex:1 1 100%;min-width:0}}
```

Also change the nav's `<a href="login.html">Sign In</a>` to `<a href="https://app.theplugai.xyz/login">Sign In</a>`.

- [ ] **Step 3: Replace `join.html`, `login.html`, and `home.html` with redirects**

For each, replace the whole file. `join.html` (substitute `/login` and `/dashboard` for the other two, and adjust the wording):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Forming Paws — moved</title>
<meta http-equiv="refresh" content="0; url=https://app.theplugai.xyz/signup">
<link rel="canonical" href="https://app.theplugai.xyz/signup">
<script>location.replace("https://app.theplugai.xyz/signup");</script>
</head>
<body>
<p>Forming Paws has moved to <a href="https://app.theplugai.xyz/signup">app.theplugai.xyz</a>.</p>
</body>
</html>
```

Both the meta refresh and the JS are present on purpose: the meta refresh works without JavaScript, and `location.replace` avoids poisoning the back button.

- [ ] **Step 4: Replace `confirm.html` with a payload-preserving forwarder**

A meta refresh drops the query string and fragment, and that is where the entire auth payload lives. This one must be JavaScript, and it must branch:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Forming Paws — finishing sign-in</title>
<script>
(function () {
  var APP = "https://app.theplugai.xyz";
  var hash = location.hash || "";
  var search = location.search || "";

  if (/access_token=/.test(hash)) {
    // Legacy implicit-flow links carry the session in the fragment. A fragment
    // is never sent to the server, so this must land on a page that renders the
    // React tree -- HashSessionRecovery mounts in the root layout and claims it.
    // /auth/confirm is a route handler with no React tree and cannot see it.
    location.replace(APP + "/" + hash);
  } else if (/token_hash=/.test(search)) {
    location.replace(APP + "/auth/confirm" + search);
  } else {
    location.replace(APP + "/login");
  }
})();
</script>
</head>
<body>
<p>Finishing your sign-in… <a href="https://app.theplugai.xyz/login">Continue</a>.</p>
</body>
</html>
```

- [ ] **Step 5: Relabel `app.html` as sample data**

Change the nav pill text from `Demo · seeded data` to `Sample dogs · not real listings`, and replace the `.app-head` paragraph with:

```html
      <p>📍 These are <strong>sample dogs</strong>, not real listings.
         <a href="https://app.theplugai.xyz/signup">Create an account</a> to see verified dogs near you.</p>
```

Keep the page. It is the only thing a visitor can look at before creating an account; deleting it blanks the top of the funnel.

- [ ] **Step 6: Verify every redirect resolves**

```bash
for p in join.html login.html home.html confirm.html; do
  echo "$p -> $(curl -s https://theplugai.xyz/$p | grep -o 'app\.theplugai\.xyz[^"<]*' | head -1)"
done
```

Expected: each prints the app URL it forwards to. Then load `https://theplugai.xyz/join.html` in a browser and confirm it lands on the app's signup page.

- [ ] **Step 7: Commit and publish**

```bash
git add index.html app.html join.html login.html home.html confirm.html
git commit -m "chore(site): point member paths at app.theplugai.xyz"
git push origin gh-pages
gh workflow run "Deploy static site (gh-pages content)"
```

- [ ] **Step 8: Remove the worktree**

```bash
git worktree remove ../forming-paws-ghpages
```

---

## Definition of done

A person who signed up on the static site can log into `app.theplugai.xyz`, see the dog they already registered with its real verification status, upload a health document, and browse other dogs — with lint and CI green, and no outstanding security advisories for `dog_photos` or leaked passwords.

## Deliberately not done in this slice

In-app chat (Slice B) · SEO, Open Graph, privacy policy, terms (Slice C) · photo gallery and profile polish (Slice D) · vet referral network and education hub (Slice E) · consolidating `admin.html` into the app's admin area · deduplicating the breed list across the four places it now lives.

`spatial_ref_sys` RLS and PostGIS-in-`public` stay open by decision: both are stock Supabase/PostGIS defaults, and relocating the extension risks breaking the geo functions `/browse` depends on for no real gain.
