# Forming Paws — Slice A: Ship & Harden

**Date:** 2026-08-09
**Status:** Approved
**Supersedes:** the 2026-07-22 "no hosted deploy" decision for the Next.js app

## Problem

Two divergent products run against one Supabase project, and the real users are on the weaker one.

The live static site at `theplugai.xyz` lets a visitor create an account and add a dog, then tells them *"we'll email you when your dog's health vault is ready."* Health-document upload, admin review, geolocation browse, and mutual matching all exist and work — in the Next.js app, which runs only on the founder's laptop.

As of 2026-08-09 the database holds 7 owners, 5 dogs, 4 health documents, 2 interests, 1 match, and 1 waitlist signup, with 5 of 7 users email-confirmed. **Those 5 confirmed members have no path to the features the site promises them.**

A secondary cost: onboarding logic, the breed list, and auth handling are duplicated across `join.html`, `home.html`, `admin.html`, and the Next.js app. Four copies, already drifting.

## Goal

Make the real app reachable at a stable URL, and clear the defect backlog that would otherwise ship with it. Nothing new is built in this slice.

## Non-goals

Explicitly deferred to later slices, and out of scope here:

- In-app chat (Slice B)
- SEO, Open Graph, privacy policy, terms (Slice C)
- Photo gallery and profile polish (Slice D)
- Vet referral network, education hub (Slice E)
- Consolidating `admin.html` into the app's admin area
- Any change to the matching algorithm, health-verification rules, or data model

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Host | Vercel | `vercel.json` on `main` already pins `framework: nextjs`; the app needs SSR, which GitHub Pages cannot serve |
| Domain | `app.theplugai.xyz` | Subdomain of a domain already owned — no purchase. `formingpaws.org` was available at $8.49/yr and declined |
| Marketing site | Stays on GitHub Pages at `theplugai.xyz` | Working, indexed, printed on flyers and QR codes |
| Superseded static pages | Redirect, don't delete | Printed QR codes and bookmarks must keep working |
| `app.html` demo | Keep, relabelled | It is the only thing a visitor can look at before creating an account; deleting it blanks the top of the funnel |

## Target architecture

```
                    ┌──────────────────────────┐
   visitor  ───────▶│  theplugai.xyz           │  GitHub Pages, gh-pages branch
                    │  · landing (index.html)  │
                    │  · app.html (sample data)│
                    │  · admin.html (roster)   │
                    │  · join/login/home ──────┼──▶ redirect
                    └──────────────────────────┘        │
                                                        ▼
                    ┌──────────────────────────────────────┐
   member   ───────▶│  app.theplugai.xyz                   │  Vercel, main branch
                    │  /signup /login /dashboard           │
                    │  /dogs/new /dogs/[id]                │
                    │  /browse /matches                    │
                    │  /admin/review-queue                 │
                    └──────────────────────────────────────┘
                                     │
                    ┌────────────────▼─────────────────────┐
                    │  Supabase wyzcnkdonbdykidmcxvx       │
                    │  one project, shared by both         │
                    └──────────────────────────────────────┘
```

Because both surfaces share one Supabase project, **existing members' accounts and dogs already exist in the app**. There is no data migration. What they gain on day one is health-document upload, browse, and matching.

### Redirect map

| Static page | Redirects to | Method |
|---|---|---|
| `join.html` | `app.theplugai.xyz/signup` | `<meta http-equiv="refresh">` + visible link |
| `login.html` | `app.theplugai.xyz/login` | same |
| `home.html` | `app.theplugai.xyz/dashboard` | same |
| `confirm.html` | branches — see below | JS, because the token arrives in the URL |
| `app.html` | *(no redirect — relabelled "Sample dogs")* | CTA points to `/signup` |
| `admin.html` | *(unchanged)* | No app equivalent yet; consolidation deferred |

`confirm.html` needs a JS redirect rather than a meta refresh, because a meta refresh drops the query string and fragment — and that is where the entire payload lives. It must branch on which kind of link arrived:

- **`?token_hash=…`** (current template) → `app.theplugai.xyz/auth/confirm` with the query string intact. This is a route handler, which can read a query string.
- **`#access_token=…`** (legacy implicit-flow links already sitting in inboxes) → `app.theplugai.xyz/` with the fragment intact. It must **not** go to `/auth/confirm`: that is a route handler with no React tree, so `HashSessionRecovery` never mounts there, and a route handler can never see a fragment in the first place. The app root renders the layout, so the component mounts and claims the session.
- **Neither** → `app.theplugai.xyz/login`.

## Work items

### 1. Recover stranded work — DONE

Auth fixes had been sitting uncommitted for two days on `fix/upload-redirect`, a branch whose own PR had already merged. Moved to `fix/email-confirm-flow` off `origin/main` and opened as **PR #16**.

The original branch was *behind* `main`: committing from it would have regressed the `303` status on the upload redirects merged in #14. Without `303`, a POST redirect re-issues the POST.

This PR is a **hard prerequisite** for deploy. It adds `getRequestOrigin`, which derives redirect origins from `x-forwarded-host` — behind Vercel's proxy, `request.url` carries the internal host, so redirects built from it point somewhere the user cannot reach. Deploying without it means broken auth redirects in production.

### 2. Restore lint coverage

`npm run lint` fails outright: ESLint 9 requires flat config and the repo has none. There is currently **zero** lint coverage.

Add `eslint.config.mjs` extending `next/core-web-vitals`, then fix what it reports. If the volume is large, fix errors and leave warnings for a follow-up rather than expanding this slice.

### 3. Add CI

`main` has one workflow, `deploy-static-site.yml`, and it is `workflow_dispatch` only — a manual publish, not CI. Nothing verifies a push.

Add `.github/workflows/ci.yml` running `tsc --noEmit`, `npm run lint`, and `npm test` on pull requests and pushes to `main`. Playwright e2e stays out of CI — it needs live Supabase fixture credentials.

### 4. Deploy

- Inspect the existing Vercel `forming-paws` project; repurpose it to build `main` if its settings permit, otherwise create a fresh project.
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production and Preview. These are the only two env vars the app requires. Both are publishable values; RLS is the security boundary, not key secrecy.
- Attach `app.theplugai.xyz`.
- Confirm Hobby tier with no paid add-ons. **This is the top risk** — a Vercel billing cap is what ended the previous hosting attempt.

### 5. Close the security findings

- **Migration 0019** — `dog_photos_select_browsable` is `USING (true)` for `authenticated`, so any signed-in user can enumerate every photo row, including those belonging to unverified and non-browsable dogs. Restrict it to `EXISTS (SELECT 1 FROM dogs_browsable b WHERE b.id = dog_photos.dog_id)`; the view exposes `id`, confirmed against the live schema.

  **Do not touch `dog_photos_select_own`.** It is a separate policy and it is what lets an owner see their own dog's photos while that dog is still unverified — i.e. during the upload flow, before it appears in `dogs_browsable`. Policies are OR'd, so tightening the browsable one alone is sufficient and safe. Removing or merging them would break upload.
- **Leaked-password protection** — currently disabled in Supabase Auth. Dashboard toggle.
- **Documented, not fixed:** `spatial_ref_sys` has RLS disabled and PostGIS is installed in `public`. Both are stock Supabase/PostGIS defaults; relocating the extension risks breaking the geo functions that `/browse` depends on, for no real gain.

RLS was re-audited across every policy in `public` and is otherwise correct. Owners, waitlist, health documents, dog interests, and matches are all properly gated. July's hardening held.

### 6. Fix the static site

- ~~`home.html` hardcodes `Verification pending`~~ — **moot, and the fix belongs elsewhere.** `home.html` redirects to the app, so patching its badge is wasted work. But the app's `/dashboard` shows only name and sex, with no verification status at all, so redirecting there would *downgrade* what members see today. The real fix is **task 6 below**: put the badge on the app dashboard.
- `index.html` redirects to `home.html` on any stored `fp_session` without checking `expires_at`, producing a flash-bounce to login on a dead session. Redirect only when the session is unexpired or still holds a refresh token; otherwise clear it.
- Apply the redirect map above.
- Relabel `app.html` as sample data with a CTA to `/signup`.

## Verification

No item is complete until its check has been run and its output observed.

| Item | Check |
|---|---|
| PR #16 | `tsc` exit 0 · 27/27 unit tests · clean build — **already verified** |
| Lint | `npm run lint` exits 0 |
| CI | A pull request shows the workflow running and passing |
| Deploy | `curl -o /dev/null -w '%{http_code}'` returns 200 for `/`, `/login`, `/signup` on `app.theplugai.xyz` |
| Auth end-to-end | Sign up a fresh address; confirmation email link resolves to `app.theplugai.xyz/auth/confirm` and lands on `/dashboard` |
| Existing members | Log in as an `.env.local` e2e fixture owner against production; their dog appears on `/dashboard` |
| Migration 0019 | As a signed-in non-owner, `GET /rest/v1/dog_photos` returns only browsable dogs' rows |
| Redirects | Each superseded static page lands on its app equivalent |
| Advisors | `get_advisors(security)` no longer reports the `dog_photos` or leaked-password findings |

Playwright e2e continues to run locally against `localhost`. Production gets the manual smoke checklist above rather than a rewired e2e suite — repointing e2e at production would create real accounts in the members table.

## Steps requiring the founder

Three actions cannot be automated from here. Exact values will be supplied when the deploy reaches each point.

1. **GoDaddy DNS** — add a CNAME for `app` pointing at Vercel.
2. **Supabase → Authentication → URL Configuration** — add `app.theplugai.xyz` to Redirect URLs. Skipping this breaks confirmation emails for every new signup.
3. **Supabase → Authentication → Policies** — enable leaked-password protection.

## Risks

| Risk | Mitigation |
|---|---|
| Vercel billing cap — ended the last hosting attempt | Hobby tier, no add-ons, spend limits confirmed before launch |
| Deploying before PR #16 merges | Explicit ordering: #16 merges first. Without `getRequestOrigin`, production auth redirects break |
| Supabase free-tier signup email rate limit | Test with one fresh address, not repeated signups within an hour |
| DNS propagation delay | Verify against the `.vercel.app` URL first; treat DNS as the last step |
| Lint surfacing a large backlog | Fix errors, defer warnings — do not let lint expand the slice |

## Definition of done

A person who signed up on the static site can log into `app.theplugai.xyz`, see the dog they already registered, upload a health document, and browse other dogs — with lint and CI green, and no outstanding security advisories for `dog_photos` or leaked passwords.
