# Forming Paws — Phase 2, Slice 1 Design

## Context

Phase 0 (Alignment Brief) and Phase 1 (Agent Team) were designed and approved 2026-07-04 (`2026-07-04-forming-paws-foundation-design.md`). This document covers Phase 2 — the product build — scoped to a first deliverable slice rather than all 8 MVP features from the master build prompt at once, per Stefan's 30 min/day constraint and the master prompt's own "small, reviewable increments" rule.

**Slice 1 scope:** owner accounts, dog profiles, health document upload + verification, search/filters, and the browse → express-interest → mutual-match flow. Chat, education hub, admin UI polish beyond a bare review queue, donations, vet-referral, breeding-outcome tracking, native mobile, and Apple Sign-In are explicitly deferred to later slices.

## Architecture & Stack

- **Repo:** `~/forming-paws` (already initialized; this spec and the Phase 0/1 spec live here)
- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind, mobile-first
- **Deployment:** Netlify (free tier) — switched from Vercel 2026-07-08 after hitting a billing/usage cap on the account
- **Backend/DB:** a **new, dedicated Supabase project** — not shared with The Plug AI's project (`fqdrvhpdntflfkqxlvkq`). Health records and a separate nonprofit's user data shouldn't share a database or RLS policy set with an unrelated project.
- **Supabase setup path:** driven through the Supabase MCP tools (`create_project`, `apply_migration`, `execute_sql`) rather than requiring a local `supabase` CLI install (not currently installed, and MCP avoids the dependency).
- **Auth:** Supabase email/password + Google OAuth only. Apple Sign-In deferred — it requires a $99/year Apple Developer Program enrollment, which conflicts with the $0-capital constraint from Phase 0. Revisit once there's revenue.
- **Geo:** PostGIS extension (via Supabase) for radius search.
- **Testing:** Vitest for unit/component logic, Playwright for one end-to-end smoke test per feature area.

## Data Model

| Table | Key columns | RLS rule |
|---|---|---|
| `owners` | `id` (=`auth.users.id`), `display_name`, `is_admin` (bool, default false), `location_point` (`geography(Point,4326)`, nullable), `location_label` (city-level text), `created_at` | Owner reads/updates only their own row. `location_point` is **never** returned to other users via any policy or view — only derived distance/city label are exposed, computed server-side. |
| `breeds` | `id`, `name` | Static reference table, seeded once from a bundled JSON list (~200 AKC-style breed names). Read-only to all; no user writes. Structured breed selection, not free text. |
| `dogs` | `id`, `owner_id` (FK), `name`, `breed_id` (FK), `sex`, `birth_date`, `weight_lbs`, `temperament_notes`, `created_at` | Owner has full CRUD on their own dogs. **Public read** of a limited column set (name, breed, sex, computed age, photo thumbnails) for all signed-in owners — browsing is open, not gated. |
| `dog_photos` | `id`, `dog_id` (FK), `storage_path`, `position` | Owner-only CRUD via `dogs.owner_id` join. Private Storage bucket, signed URLs only. Max 5 photos/dog, max 5MB/file. EXIF/GPS metadata stripped server-side (Next.js API route using `sharp`, deployed as a Netlify Function) before the file reaches Storage. |
| `health_documents` | `id`, `dog_id` (FK), `storage_path`, `doc_type` (enum: `vet_exam`, `vaccination`, `ofa`, `dna_panel`), `document_date` (date on the document itself — exam/vaccination date, distinct from `uploaded_at`), `status` (enum: `unverified`, `pending_review`, `verified`, `rejected`), `uploaded_at`, `reviewed_at`, `reviewer_notes` | Owner can insert/read their own dog's docs. Only `is_admin` owners can update `status`/`reviewer_notes`. |
| `dog_interests` | `id`, `expressing_dog_id` (FK), `target_dog_id` (FK), `created_at` | Owner can insert only where `expressing_dog_id` belongs to them, and only if `dog_is_baseline_verified(expressing_dog_id)` is true. Read: owner can see interests involving their own dogs. |
| `matches` | `id`, `dog_a_id`, `dog_b_id`, `matched_at` | System-created (via trigger/function) when both directions of `dog_interests` exist. Read-only to the two owners involved. |

**`dog_is_baseline_verified(dog_id)`** — a Postgres function checking that the dog has a `verified` `vet_exam` doc with `document_date` within the last 12 months AND a `verified` `vaccination` doc. This encodes the Phase 0 rule ("matching unlocks only after baseline health docs") once, in the data layer, so both the interest-gating logic here and any future chat-gating logic in a later slice can call the same function rather than re-deriving the rule.

## Feature Flows

**Auth & profile:**
- `/signup`, `/login` — Supabase email auth + Google OAuth button

**Dog profiles:**
- `/dashboard` — owner's dog list, "add a dog" entry point
- `/dogs/new` — create dog profile (name, breed dropdown from `breeds`, sex, birth date, weight, temperament notes)
- `/dogs/[id]` — profile detail: photo gallery (upload/reorder/delete), health document upload (pick `doc_type` + `document_date` + file), status badge per doc, "Express Interest" button on other owners' dogs (disabled with an explanation if the viewer's own dog isn't baseline-verified)

**Search & browse:**
- `/browse` — filterable list (breed, sex, distance radius, verified-health-only toggle, age range), open to all signed-in owners regardless of their own dogs' verification status. Geolocation consent prompt (browser API) on first visit — declining just excludes that owner's dogs from distance-sorted results, browsing still works.

**Matching:**
- Expressing interest requires the initiating dog to be baseline-verified (enforced by RLS on `dog_interests` insert)
- Mutual match (both directions recorded) auto-creates a `matches` row
- `/matches` — list of mutual matches; no messaging yet, just match confirmation ("chat coming in a later slice")

**Admin (bare-bones for this slice):**
- `/admin/review-queue` — admin-only route (guarded by `owners.is_admin`), flat list of `pending_review` docs with approve/reject + notes. `is_admin` is set manually via SQL for Stefan's account after signup — no separate admin auth system yet.

## Testing

- Vitest: EXIF-stripping helper, `dog_is_baseline_verified` (against a test Supabase branch), interest→match trigger logic
- Playwright, one e2e path: signup → create dog → upload health docs → (as admin) approve them → dog becomes baseline-verified → browse as a second test owner → express interest both ways → see a match appear

## Explicitly Out of Scope for This Slice

Chat/messaging UI, education hub (CMS-lite articles), admin UI beyond the bare review queue, Stripe/donations, vet-referral directory, breeding-outcome tracking, native mobile app (React Native/Expo), Apple Sign-In. These map to Slice 2+ per the master build prompt's post-MVP-within-MVP ordering.

## Data & Privacy Constraints Carried Forward from Phase 0/Master Prompt

- Row-level security on every table above — no exceptions
- Health documents private by default (owner controls what's visible; Slice 1 exposes only verification *status*, never the document file, to other users)
- Raw geolocation never exposed — distance/city label only
- Minors cannot register (age-gate at signup — Terms of Service acceptance checkbox includes an 18+ attestation for Slice 1; a stronger check is a later-slice concern)
- No auto-approval of breeding matches — a visible disclaimer states the platform facilitates introductions only and is not a party to any breeding arrangement
