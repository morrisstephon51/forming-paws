# Forming Paws — Browse, Search & Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the search/browse/matching half of Slice 1 that Tasks 1–10 deferred: owners can set a location, browse other owners' dogs with filters, and mutually express interest to form a match.

**Architecture:** Next.js 15 App Router server components + a Postgres RPC function (`browse_dogs`) that does filtering/sorting/distance math server-side so raw geolocation is never returned to the client. A `dogs_browsable` view (created by the migration-running role, which bypasses RLS) exposes only the spec's public column set for other owners' dogs; the base `dogs` table's owner-only RLS is untouched, so `weight_lbs`/`temperament_notes` stay owner-private. `dog_interests` + a `matches` trigger implement the mutual-match rule directly in Postgres.

**Tech Stack:** Next.js 15 (App Router, TypeScript, Tailwind) + Supabase (Postgres, PostGIS, Auth, Storage), applied via the Supabase MCP tools (`mcp__claude_ai_Supabase__apply_migration`, project_id `wyzcnkdonbdykidmcxvx`) per this repo's existing convention — no local `supabase` CLI.

## Global Constraints

- Every new table needs RLS enabled — no exceptions (spec: "Row-level security on every table above — no exceptions").
- `owners.location_point` must never be returned to another user via any policy, view, or RPC — only a computed distance (number) or the owner's own manually-entered `location_label` (city text) may cross that boundary.
- Health documents stay private: other owners see only the `dog_is_baseline_verified` boolean, never document files or per-doc status.
- No hosted deploy target for this repo right now (see plan `2026-07-05-forming-paws-foundation-and-profiles.md`, Task 11) — everything in this plan runs and is tested locally (`npm run dev` / `npx playwright test`).
- Match `dog_a_id`/`dog_b_id` in `matches` must be canonically ordered (`dog_a_id < dog_b_id`) so both directions of a mutual interest resolve to one row.

---

### Task 1: Owner location — migration, settings UI, server action

**Files:**
- Create: `supabase/migrations/0008_owner_location.sql`
- Create: `lib/actions/location.ts`
- Create: `app/dashboard/LocationSettings.tsx`
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Produces: `updateMyLocation(latitude: number, longitude: number, cityLabel: string): Promise<void>` (server action, throws on error) — consumed by Task 3's `LocationPrompt`.
- Produces: `owners.location_point` (`geography(Point,4326)`, nullable), `owners.location_label` (`text`, nullable) — consumed by Task 2's `browse_dogs` RPC.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0008_owner_location.sql
create extension if not exists postgis;

alter table public.owners
  add column location_point geography(Point, 4326),
  add column location_label text;
```

- [ ] **Step 2: Apply the migration via the Supabase MCP tool**

Call `mcp__claude_ai_Supabase__apply_migration` with `project_id: "wyzcnkdonbdykidmcxvx"`, `name: "owner_location"`, and the SQL from Step 1.
Expected: success, no error.

- [ ] **Step 3: Write the server action**

```typescript
// lib/actions/location.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateMyLocation(latitude: number, longitude: number, cityLabel: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')

  const { error } = await supabase
    .from('owners')
    .update({
      location_point: `SRID=4326;POINT(${longitude} ${latitude})`,
      location_label: cityLabel,
    })
    .eq('id', userData.user.id)

  if (error) throw error
  revalidatePath('/dashboard')
  revalidatePath('/browse')
}
```

- [ ] **Step 4: Write the location settings client component**

```tsx
// app/dashboard/LocationSettings.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateMyLocation } from '@/lib/actions/location'

export default function LocationSettings({ currentLabel }: { currentLabel: string | null }) {
  const router = useRouter()
  const [cityLabel, setCityLabel] = useState(currentLabel ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function handleShare() {
    setError(null)
    if (!cityLabel.trim()) {
      setError('Enter your city first')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsSaving(true)
        updateMyLocation(position.coords.latitude, position.coords.longitude, cityLabel.trim())
          .then(() => router.refresh())
          .catch((err) => setError(err instanceof Error ? err.message : 'Failed to save location'))
          .finally(() => setIsSaving(false))
      },
      () => setError('Location permission denied — distance sorting will be unavailable')
    )
  }

  return (
    <div className="mt-4 rounded border p-4">
      <p className="text-sm font-medium">Location</p>
      <p className="text-sm text-gray-600">
        {currentLabel ? `Currently set to ${currentLabel}.` : 'Not set — browse still works without it.'}
      </p>
      <div className="mt-2 flex gap-2">
        <input
          value={cityLabel}
          onChange={(e) => setCityLabel(e.target.value)}
          placeholder="Your city"
          className="border p-2 text-sm flex-1"
        />
        <button
          onClick={handleShare}
          disabled={isSaving}
          className="bg-gray-900 text-white px-3 py-1 rounded text-sm"
        >
          {isSaving ? 'Saving…' : 'Share location'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Wire it into the dashboard**

In `app/dashboard/page.tsx`, add the import and fetch `location_label` for the current owner, then render it. Modify the top of the file:

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LocationSettings from './LocationSettings'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: owner } = await supabase
    .from('owners')
    .select('location_label')
    .eq('id', userData.user.id)
    .single()

  const { data: dogs, error } = await supabase
    .from('dogs')
    .select('id, name, sex, birth_date, breeds(name)')
    .eq('owner_id', userData.user.id)

  if (error) throw error

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your dogs</h1>
        <div className="flex gap-3 items-center">
          <Link href="/browse" className="text-sm underline text-gray-600">
            Browse
          </Link>
          <Link href="/matches" className="text-sm underline text-gray-600">
            Matches
          </Link>
          <Link href="/dogs/new" className="bg-gray-900 text-white px-4 py-2 rounded">
            Add a dog
          </Link>
        </div>
      </div>
      <LocationSettings currentLabel={owner?.location_label ?? null} />
      <ul className="mt-6 flex flex-col gap-3">
        {dogs?.map((dog) => (
          <li key={dog.id}>
            <Link href={`/dogs/${dog.id}`} className="block border p-4 rounded hover:bg-gray-50">
              {dog.name} — {dog.sex}
            </Link>
          </li>
        ))}
        {dogs?.length === 0 && <p className="text-gray-500">No dogs yet.</p>}
      </ul>
    </main>
  )
}
```

- [ ] **Step 6: Manual check**

Run: `npm run dev`, sign in with the `E2E_FIXTURE_EMAIL`/`E2E_FIXTURE_PASSWORD` account from `.env.local`, visit `/dashboard`.
Expected: a "Location" box appears with a city input and "Share location" button; browser prompts for geolocation permission on click; after allowing and confirming, the box updates to "Currently set to <city>."

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0008_owner_location.sql lib/actions/location.ts app/dashboard/LocationSettings.tsx "app/dashboard/page.tsx"
git commit -m "Add owner location settings (PostGIS point + city label)"
```

---

### Task 2: Browsable dogs — view, RLS, and the `browse_dogs` search RPC

**Files:**
- Create: `supabase/migrations/0009_browse_dogs.sql`
- Create: `lib/dogPhotos.ts`

**Interfaces:**
- Consumes: `owners.location_point`/`location_label` (Task 1).
- Produces: `public.dogs_browsable` view (`id, owner_id, name, breed_name, sex, birth_date, created_at`) — consumed by Task 5's dog detail page.
- Produces: `public.browse_dogs(p_breed_id bigint, p_sex dog_sex, p_verified_only boolean, p_min_age_years int, p_max_age_years int, p_radius_miles numeric) returns table(id uuid, name text, breed_name text, sex dog_sex, birth_date date, owner_id uuid, location_label text, distance_miles numeric)` — consumed by Task 3's `/browse` page.
- Produces: `getThumbnailUrl(supabase, dogId: string): Promise<string | null>` — consumed by Task 3 and Task 5.

- [ ] **Step 1: Write the migration**

This also fixes a real bug found while designing this feature: `dog_is_baseline_verified` (migration 0007) isn't `security definer`, so its internal query against `health_documents` is filtered by `health_documents_select_own` RLS — meaning it silently returns `false` for any dog the caller doesn't own, which would break the verification badge the moment someone browses another owner's dog.

```sql
-- supabase/migrations/0009_browse_dogs.sql

-- Fix: dog_is_baseline_verified must bypass RLS to correctly report verification
-- status for dogs the caller doesn't own (needed for the browse/detail views below).
create or replace function public.dog_is_baseline_verified(p_dog_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.health_documents
      where dog_id = p_dog_id
        and doc_type = 'vet_exam'
        and status = 'verified'
        and document_date >= (current_date - interval '12 months')
    )
    and exists (
      select 1 from public.health_documents
      where dog_id = p_dog_id
        and doc_type = 'vaccination'
        and status = 'verified'
    );
$$;

-- Public read of a limited column set for browsing (spec: "Public read of a
-- limited column set ... for all signed-in owners"). weight_lbs and
-- temperament_notes are deliberately excluded. This view is created by the
-- migration-running role, which bypasses the dogs table's owner-only RLS —
-- the base `dogs` table itself stays owner-only; only these columns are ever
-- exposed for rows the caller doesn't own.
create view public.dogs_browsable as
select
  d.id,
  d.owner_id,
  d.name,
  d.breed_id,
  b.name as breed_name,
  d.sex,
  d.birth_date,
  d.created_at
from public.dogs d
join public.breeds b on b.id = d.breed_id;

grant select on public.dogs_browsable to authenticated;

-- dog_photos has no sensitive columns (just a storage pointer + position), so
-- open row-level SELECT to all authenticated users for browsing thumbnails.
create policy "dog_photos_select_browsable" on public.dog_photos
  for select to authenticated using (true);

-- Same for the storage objects themselves — a new SELECT-only policy so any
-- authenticated user can generate a signed URL for any dog's photo. Insert/
-- update/delete stay owner-only via the existing "for all" policy.
create policy "dog_photos_storage_browsable_select" on storage.objects
  for select using (bucket_id = 'dog-photos');

-- Server-side search + distance calculation. security definer so it can read
-- other owners' location_point (otherwise blocked by owners' own-row-only
-- RLS) to compute distance — but it only ever returns the computed number,
-- never the raw point.
create or replace function public.browse_dogs(
  p_breed_id bigint default null,
  p_sex public.dog_sex default null,
  p_verified_only boolean default false,
  p_min_age_years int default null,
  p_max_age_years int default null,
  p_radius_miles numeric default null
)
returns table (
  id uuid,
  name text,
  breed_name text,
  sex public.dog_sex,
  birth_date date,
  owner_id uuid,
  location_label text,
  distance_miles numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.name,
    b.name as breed_name,
    d.sex,
    d.birth_date,
    d.owner_id,
    o.location_label,
    case
      when me.location_point is not null and o.location_point is not null
        then st_distance(me.location_point, o.location_point) / 1609.34
      else null
    end as distance_miles
  from public.dogs d
  join public.breeds b on b.id = d.breed_id
  join public.owners o on o.id = d.owner_id
  left join public.owners me on me.id = auth.uid()
  where d.owner_id <> auth.uid()
    and (p_breed_id is null or d.breed_id = p_breed_id)
    and (p_sex is null or d.sex = p_sex)
    and (p_verified_only is false or public.dog_is_baseline_verified(d.id))
    and (p_min_age_years is null or d.birth_date <= current_date - (p_min_age_years || ' years')::interval)
    and (p_max_age_years is null or d.birth_date >= current_date - (p_max_age_years || ' years')::interval)
    and (
      p_radius_miles is null
      or me.location_point is null
      or o.location_point is null
      or st_distance(me.location_point, o.location_point) / 1609.34 <= p_radius_miles
    )
  order by distance_miles nulls last, d.created_at desc;
$$;

grant execute on function public.browse_dogs to authenticated;
```

- [ ] **Step 2: Apply the migration via the Supabase MCP tool**

Call `mcp__claude_ai_Supabase__apply_migration` with `project_id: "wyzcnkdonbdykidmcxvx"`, `name: "browse_dogs"`, and the SQL from Step 1.
Expected: success, no error.

- [ ] **Step 3: Write the shared thumbnail helper**

```typescript
// lib/dogPhotos.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getThumbnailUrl(
  supabase: SupabaseClient,
  dogId: string
): Promise<string | null> {
  const { data: photo } = await supabase
    .from('dog_photos')
    .select('storage_path')
    .eq('dog_id', dogId)
    .order('position')
    .limit(1)
    .maybeSingle()

  if (!photo) return null

  const { data } = await supabase.storage.from('dog-photos').createSignedUrl(photo.storage_path, 3600)

  return data?.signedUrl ?? null
}
```

- [ ] **Step 4: Manual check**

Run: `npm run dev`, then in the browser console on any signed-in page:
```js
fetch('/api/health-check-not-real') // placeholder to confirm dev server is up, then use the Supabase JS client in a page instead
```
Actually verify via the app directly once Task 3 builds `/browse` — this task has no standalone UI, so defer visible verification to Task 3's manual check. Confirm instead via SQL: call `mcp__claude_ai_Supabase__execute_sql` with `project_id: "wyzcnkdonbdykidmcxvx"` and query `select * from public.dogs_browsable limit 5;` — expected: returns rows with only `id, owner_id, name, breed_id, breed_name, sex, birth_date, created_at` (no `weight_lbs`/`temperament_notes`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0009_browse_dogs.sql lib/dogPhotos.ts
git commit -m "Add dogs_browsable view, browse_dogs search RPC, and fix baseline-verified RLS bypass"
```

---

### Task 3: `/browse` page

**Files:**
- Create: `app/browse/page.tsx`
- Create: `app/browse/LocationPrompt.tsx`

**Interfaces:**
- Consumes: `browse_dogs` RPC and `getThumbnailUrl` (Task 2), `updateMyLocation` (Task 1).

- [ ] **Step 1: Write the geolocation prompt (shown only when the owner has no location set yet)**

```tsx
// app/browse/LocationPrompt.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateMyLocation } from '@/lib/actions/location'

export default function LocationPrompt() {
  const router = useRouter()
  const [cityLabel, setCityLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function handleShare() {
    setError(null)
    if (!cityLabel.trim()) {
      setError('Enter your city first')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsSaving(true)
        updateMyLocation(position.coords.latitude, position.coords.longitude, cityLabel.trim())
          .then(() => router.refresh())
          .catch((err) => setError(err instanceof Error ? err.message : 'Failed to save location'))
          .finally(() => setIsSaving(false))
      },
      () => setError('Location permission denied — you can still browse without distance sorting')
    )
  }

  return (
    <div className="mt-4 rounded border p-4">
      <p className="text-sm text-gray-600">
        Share your location to sort by distance. Declining just skips distance sorting — browsing still works.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          value={cityLabel}
          onChange={(e) => setCityLabel(e.target.value)}
          placeholder="Your city"
          className="border p-2 text-sm flex-1"
        />
        <button
          onClick={handleShare}
          disabled={isSaving}
          className="bg-gray-900 text-white px-3 py-1 rounded text-sm"
        >
          {isSaving ? 'Saving…' : 'Share location'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Write the browse page**

```tsx
// app/browse/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getBreeds } from '@/lib/breeds'
import { getThumbnailUrl } from '@/lib/dogPhotos'
import LocationPrompt from './LocationPrompt'

function calculateAge(birthDate: string): number {
  const diffMs = Date.now() - new Date(birthDate).getTime()
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000))
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{
    breedId?: string
    sex?: string
    verifiedOnly?: string
    minAge?: string
    maxAge?: string
    radiusMiles?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: me } = await supabase
    .from('owners')
    .select('location_label')
    .eq('id', userData.user.id)
    .single()
  const hasLocation = !!me?.location_label

  const breeds = await getBreeds()

  const { data: dogs, error } = await supabase.rpc('browse_dogs', {
    p_breed_id: params.breedId ? Number(params.breedId) : null,
    p_sex: params.sex || null,
    p_verified_only: params.verifiedOnly === 'true',
    p_min_age_years: params.minAge ? Number(params.minAge) : null,
    p_max_age_years: params.maxAge ? Number(params.maxAge) : null,
    p_radius_miles: params.radiusMiles ? Number(params.radiusMiles) : null,
  })

  if (error) throw error

  const dogsWithPhotos = await Promise.all(
    (dogs ?? []).map(async (dog) => ({
      ...dog,
      photoUrl: await getThumbnailUrl(supabase, dog.id),
    }))
  )

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Browse dogs</h1>
        <Link href="/dashboard" className="text-sm text-gray-600 underline">
          Back to dashboard
        </Link>
      </div>

      {!hasLocation && <LocationPrompt />}

      <form method="get" className="mt-6 flex flex-wrap gap-2">
        <select name="breedId" defaultValue={params.breedId ?? ''} className="border p-2 text-sm">
          <option value="">Any breed</option>
          {breeds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="sex" defaultValue={params.sex ?? ''} className="border p-2 text-sm">
          <option value="">Any sex</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <input
          name="minAge"
          type="number"
          placeholder="Min age"
          defaultValue={params.minAge ?? ''}
          className="border p-2 text-sm w-24"
        />
        <input
          name="maxAge"
          type="number"
          placeholder="Max age"
          defaultValue={params.maxAge ?? ''}
          className="border p-2 text-sm w-24"
        />
        <input
          name="radiusMiles"
          type="number"
          placeholder="Radius (mi)"
          defaultValue={params.radiusMiles ?? ''}
          className="border p-2 text-sm w-28"
        />
        <label className="flex items-center gap-1 text-sm">
          <input
            name="verifiedOnly"
            type="checkbox"
            value="true"
            defaultChecked={params.verifiedOnly === 'true'}
          />
          Verified only
        </label>
        <button type="submit" className="bg-gray-900 text-white px-3 py-1 rounded text-sm">
          Filter
        </button>
      </form>

      <ul className="mt-6 flex flex-col gap-3">
        {dogsWithPhotos.map((dog) => (
          <li key={dog.id}>
            <Link href={`/dogs/${dog.id}`} className="flex gap-3 border p-3 rounded hover:bg-gray-50">
              {dog.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dog.photoUrl} alt={dog.name} className="h-16 w-16 rounded object-cover" />
              ) : (
                <div className="h-16 w-16 rounded bg-gray-100" />
              )}
              <div>
                <p className="font-medium">
                  {dog.name} — {dog.breed_name}, {calculateAge(dog.birth_date)}yo {dog.sex}
                </p>
                {dog.distance_miles != null && (
                  <p className="text-sm text-gray-500">
                    {Math.round(dog.distance_miles)} mi away
                    {dog.location_label ? ` · ${dog.location_label}` : ''}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
        {dogsWithPhotos.length === 0 && <p className="text-gray-500">No dogs match your filters.</p>}
      </ul>
    </main>
  )
}
```

- [ ] **Step 3: Manual check**

Run: `npm run dev`, sign in as the fixture owner, visit `/browse`.
Expected: page loads with a filter form; since the fixture owner is currently the only owner with a dog, the results list is empty ("No dogs match your filters.") — this is correct given `browse_dogs` excludes the caller's own dogs. Full multi-owner verification happens in Task 7's e2e test.

- [ ] **Step 4: Commit**

```bash
git add app/browse
git commit -m "Add /browse page with breed/sex/age/verified/radius filters"
```

---

### Task 4: `dog_interests` and `matches` tables

**Files:**
- Create: `supabase/migrations/0010_dog_interests_and_matches.sql`

**Interfaces:**
- Produces: `dog_interests(id, expressing_dog_id, target_dog_id, created_at)`, `matches(id, dog_a_id, dog_b_id, matched_at)` — consumed by Task 5's Express Interest form and Task 6's `/matches` page.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0010_dog_interests_and_matches.sql

create table public.dog_interests (
  id uuid primary key default gen_random_uuid(),
  expressing_dog_id uuid not null references public.dogs(id) on delete cascade,
  target_dog_id uuid not null references public.dogs(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint dog_interests_no_self check (expressing_dog_id <> target_dog_id),
  constraint dog_interests_unique unique (expressing_dog_id, target_dog_id)
);

alter table public.dog_interests enable row level security;

create policy "dog_interests_insert_own_verified" on public.dog_interests
  for insert with check (
    exists (select 1 from public.dogs d where d.id = expressing_dog_id and d.owner_id = auth.uid())
    and public.dog_is_baseline_verified(expressing_dog_id)
  );

create policy "dog_interests_select_involving_own" on public.dog_interests
  for select using (
    exists (select 1 from public.dogs d where d.id = expressing_dog_id and d.owner_id = auth.uid())
    or exists (select 1 from public.dogs d where d.id = target_dog_id and d.owner_id = auth.uid())
  );

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  dog_a_id uuid not null references public.dogs(id) on delete cascade,
  dog_b_id uuid not null references public.dogs(id) on delete cascade,
  matched_at timestamptz not null default now(),
  constraint matches_ordered check (dog_a_id < dog_b_id),
  constraint matches_unique unique (dog_a_id, dog_b_id)
);

alter table public.matches enable row level security;

create policy "matches_select_involving_own" on public.matches
  for select using (
    exists (select 1 from public.dogs d where d.id = dog_a_id and d.owner_id = auth.uid())
    or exists (select 1 from public.dogs d where d.id = dog_b_id and d.owner_id = auth.uid())
  );

-- Auto-create a match when both directions of interest exist. security
-- definer so the insert succeeds despite matches having no insert policy
-- (mirrors handle_new_user() in migration 0001).
create or replace function public.create_match_on_mutual_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.dog_interests
    where expressing_dog_id = new.target_dog_id
      and target_dog_id = new.expressing_dog_id
  ) then
    insert into public.matches (dog_a_id, dog_b_id)
    values (least(new.expressing_dog_id, new.target_dog_id), greatest(new.expressing_dog_id, new.target_dog_id))
    on conflict (dog_a_id, dog_b_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_dog_interest_created
  after insert on public.dog_interests
  for each row execute function public.create_match_on_mutual_interest();
```

- [ ] **Step 2: Apply the migration via the Supabase MCP tool**

Call `mcp__claude_ai_Supabase__apply_migration` with `project_id: "wyzcnkdonbdykidmcxvx"`, `name: "dog_interests_and_matches"`, and the SQL from Step 1.
Expected: success, no error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0010_dog_interests_and_matches.sql
git commit -m "Add dog_interests and matches tables with mutual-match trigger"
```

---

### Task 5: Dog detail page — browsable view for other owners' dogs + Express Interest

**Files:**
- Create: `app/dogs/[id]/ExpressInterestForm.tsx`
- Modify: `app/dogs/[id]/page.tsx`

**Interfaces:**
- Consumes: `dogs_browsable` view (Task 2), `dog_interests` table (Task 4).

- [ ] **Step 1: Write the Express Interest form**

```tsx
// app/dogs/[id]/ExpressInterestForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type MyDog = { id: string; name: string; isVerified: boolean }

export default function ExpressInterestForm({
  targetDogId,
  myDogs,
}: {
  targetDogId: string
  myDogs: MyDog[]
}) {
  const router = useRouter()
  const verifiedDogs = myDogs.filter((d) => d.isVerified)
  const [selectedDogId, setSelectedDogId] = useState(verifiedDogs[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (myDogs.length === 0) {
    return <p className="mt-4 text-sm text-gray-500">Add a dog of your own to express interest.</p>
  }

  if (verifiedDogs.length === 0) {
    return (
      <p className="mt-4 text-sm text-gray-500">
        Your dog needs verified health documents before it can express interest.
      </p>
    )
  }

  if (success) {
    return <p className="mt-4 text-sm text-green-600">Interest expressed!</p>
  }

  async function handleSubmit() {
    setError(null)
    const supabase = createClient()
    const { error: insertError } = await supabase
      .from('dog_interests')
      .insert({ expressing_dog_id: selectedDogId, target_dog_id: targetDogId })

    if (insertError) {
      setError(
        insertError.code === '23505' ? 'Already expressed interest from this dog' : insertError.message
      )
      return
    }

    setSuccess(true)
    router.refresh()
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      <select
        value={selectedDogId}
        onChange={(e) => setSelectedDogId(e.target.value)}
        className="border p-2 text-sm"
      >
        {verifiedDogs.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button onClick={handleSubmit} className="bg-gray-900 text-white px-3 py-1 rounded text-sm">
        Express Interest
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Replace the dog detail page**

```tsx
// app/dogs/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ExpressInterestForm from './ExpressInterestForm'

export default async function DogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: ownDog } = await supabase
    .from('dogs')
    .select('id, owner_id, name, sex, birth_date, weight_lbs, temperament_notes, breeds(name)')
    .eq('id', id)
    .maybeSingle()

  const isOwnDog = !!ownDog

  let dog: {
    id: string
    owner_id: string
    name: string
    sex: string
    birth_date: string
    temperament_notes?: string | null
    breedName: string
  }

  if (ownDog) {
    dog = { ...ownDog, breedName: (ownDog.breeds as unknown as { name: string })?.name }
  } else {
    const { data: browsableDog, error } = await supabase
      .from('dogs_browsable')
      .select('id, owner_id, name, breed_name, sex, birth_date')
      .eq('id', id)
      .maybeSingle()

    if (error || !browsableDog) notFound()
    dog = { ...browsableDog, breedName: browsableDog.breed_name }
  }

  const { data: photos } = await supabase
    .from('dog_photos')
    .select('id, storage_path')
    .eq('dog_id', id)
    .order('position')

  const { data: healthDocs } = isOwnDog
    ? await supabase
        .from('health_documents')
        .select('id, doc_type, document_date, status')
        .eq('dog_id', id)
        .order('uploaded_at', { ascending: false })
    : { data: null }

  const { data: isVerified } = await supabase.rpc('dog_is_baseline_verified', { p_dog_id: id })

  const photoUrls = await Promise.all(
    (photos ?? []).map(async (p) => {
      const { data } = await supabase.storage.from('dog-photos').createSignedUrl(p.storage_path, 3600)
      return { id: p.id, url: data?.signedUrl }
    })
  )

  let myVerifiedDogs: { id: string; name: string; isVerified: boolean }[] = []
  if (!isOwnDog) {
    const { data: myDogs } = await supabase
      .from('dogs')
      .select('id, name')
      .eq('owner_id', userData.user.id)
    myVerifiedDogs = await Promise.all(
      (myDogs ?? []).map(async (d) => {
        const { data: verified } = await supabase.rpc('dog_is_baseline_verified', { p_dog_id: d.id })
        return { id: d.id, name: d.name, isVerified: !!verified }
      })
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">{dog.name}</h1>
      {isVerified ? (
        <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mt-1">
          ✓ Baseline health verified
        </span>
      ) : (
        <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded mt-1">
          Health verification pending
        </span>
      )}
      <p className="text-gray-600">
        {dog.breedName} · {dog.sex} · born {dog.birth_date}
      </p>
      {isOwnDog && dog.temperament_notes && <p className="mt-4">{dog.temperament_notes}</p>}

      {!isOwnDog && <ExpressInterestForm targetDogId={dog.id} myDogs={myVerifiedDogs} />}

      <h2 className="mt-8 text-lg font-semibold">Photos</h2>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {photoUrls.map((p) =>
          p.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt={dog.name} className="rounded aspect-square object-cover" />
          ) : null
        )}
      </div>
      {isOwnDog && (
        <form
          action={`/api/upload/photo`}
          method="POST"
          encType="multipart/form-data"
          className="mt-4 flex gap-2"
        >
          <input type="hidden" name="dogId" value={dog.id} />
          <input type="file" name="file" accept="image/*" required />
          <button type="submit" className="bg-gray-900 text-white px-3 py-1 rounded text-sm">
            Upload photo
          </button>
        </form>
      )}

      {isOwnDog && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Health documents</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {healthDocs?.map((doc) => (
              <li key={doc.id} className="flex justify-between border p-2 rounded text-sm">
                <span>
                  {doc.doc_type} ({doc.document_date})
                </span>
                <span
                  className={
                    doc.status === 'verified'
                      ? 'text-green-600'
                      : doc.status === 'rejected'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                  }
                >
                  {doc.status}
                </span>
              </li>
            ))}
          </ul>
          <form
            action="/api/upload/health-doc"
            method="POST"
            encType="multipart/form-data"
            className="mt-4 flex flex-col gap-2 max-w-xs"
          >
            <input type="hidden" name="dogId" value={dog.id} />
            <select name="docType" required className="border p-2">
              <option value="vet_exam">Vet wellness exam</option>
              <option value="vaccination">Vaccination record</option>
              <option value="ofa">OFA hip/elbow certification</option>
              <option value="dna_panel">DNA panel</option>
            </select>
            <input name="documentDate" type="date" required className="border p-2" />
            <input type="file" name="file" accept="application/pdf,image/*" required />
            <button type="submit" className="bg-gray-900 text-white px-3 py-1 rounded text-sm">
              Upload document
            </button>
          </form>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Manual check**

Run: `npm run dev`. As the fixture owner, visit your own dog's detail page — expected: unchanged from before (photo upload, health doc upload, no Express Interest form). Full "view another owner's dog" verification happens in Task 7's e2e test, since it requires a second owner.

- [ ] **Step 4: Commit**

```bash
git add "app/dogs/[id]"
git commit -m "Show browsable profile + Express Interest for other owners' dogs"
```

---

### Task 6: `/matches` page

**Files:**
- Create: `app/matches/page.tsx`

**Interfaces:**
- Consumes: `matches` table (Task 4).

- [ ] **Step 1: Write the page**

```tsx
// app/matches/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function MatchesPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: myDogs } = await supabase.from('dogs').select('id').eq('owner_id', userData.user.id)
  const myDogIds = new Set((myDogs ?? []).map((d) => d.id))

  const { data: matches } = await supabase
    .from('matches')
    .select('id, matched_at, dogA:dog_a_id(id, name), dogB:dog_b_id(id, name)')
    .order('matched_at', { ascending: false })

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your matches</h1>
        <Link href="/dashboard" className="text-sm text-gray-600 underline">
          Back to dashboard
        </Link>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        Matches are introductions only — Forming Paws is not a party to any breeding arrangement. Chat is
        coming in a later slice.
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {matches?.map((m) => {
          const dogA = m.dogA as unknown as { id: string; name: string }
          const dogB = m.dogB as unknown as { id: string; name: string }
          const mine = myDogIds.has(dogA.id) ? dogA : dogB
          const theirs = myDogIds.has(dogA.id) ? dogB : dogA
          return (
            <li key={m.id} className="border p-4 rounded">
              <p className="font-medium">
                {mine.name} ↔ {theirs.name}
              </p>
              <p className="text-sm text-gray-500">Matched {new Date(m.matched_at).toLocaleDateString()}</p>
            </li>
          )
        })}
        {matches?.length === 0 && <p className="text-gray-500">No matches yet.</p>}
      </ul>
    </main>
  )
}
```

- [ ] **Step 2: Manual check**

Run: `npm run dev`, sign in as the fixture owner, visit `/matches`.
Expected: page loads, shows "No matches yet." (no mutual interest exists yet for this account). Full match-creation verification happens in Task 7's e2e test.

- [ ] **Step 3: Commit**

```bash
git add app/matches
git commit -m "Add /matches page"
```

---

### Task 7: Seed a second verified fixture owner + end-to-end browse/interest/match test

**Files:**
- Modify: `.env.local` (not committed — gitignored)
- Create: `tests/e2e/browse-and-match-flow.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–6.

- [ ] **Step 1: Create fixture Owner B via the signup REST endpoint**

Run (reads the anon key already in `.env.local`):

```bash
cd ~/forming-paws
ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)
curl -s "https://wyzcnkdonbdykidmcxvx.supabase.co/auth/v1/signup" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"e2e-fixture-owner-b@gmail.com","password":"testpassword123","data":{"display_name":"E2E Fixture Owner B"}}'
```

Expected: JSON response with an `id` field (the new user's UUID). Note it for Step 2.

- [ ] **Step 2: Confirm Owner B's email**

Call `mcp__claude_ai_Supabase__execute_sql` with `project_id: "wyzcnkdonbdykidmcxvx"` and:

```sql
update auth.users set email_confirmed_at = now() where email = 'e2e-fixture-owner-b@gmail.com';
```

Expected: success (no error).

- [ ] **Step 3: Seed a verified dog for each fixture owner**

Call `mcp__claude_ai_Supabase__execute_sql` with `project_id: "wyzcnkdonbdykidmcxvx"` and:

```sql
insert into public.dogs (owner_id, name, breed_id, sex, birth_date)
select id, 'Fixture Dog A', (select id from public.breeds limit 1), 'male', '2022-01-01'
from auth.users where email = 'e2e-fixture-owner@gmail.com'
on conflict do nothing;

insert into public.dogs (owner_id, name, breed_id, sex, birth_date)
select id, 'Fixture Dog B', (select id from public.breeds limit 1), 'female', '2022-01-01'
from auth.users where email = 'e2e-fixture-owner-b@gmail.com'
on conflict do nothing;

insert into public.health_documents (dog_id, storage_path, doc_type, document_date, status)
select id, 'fixture/placeholder.pdf', 'vet_exam', current_date, 'verified'
from public.dogs where name in ('Fixture Dog A', 'Fixture Dog B');

insert into public.health_documents (dog_id, storage_path, doc_type, document_date, status)
select id, 'fixture/placeholder2.pdf', 'vaccination', current_date, 'verified'
from public.dogs where name in ('Fixture Dog A', 'Fixture Dog B');
```

Expected: success. This directly seeds `verified` docs rather than going through the upload+review UI, since that flow is already covered by earlier manual testing — re-exercising it here would duplicate coverage without adding confidence in the browse/match logic this test targets.

- [ ] **Step 4: Verify both fixture dogs are baseline-verified**

Call `mcp__claude_ai_Supabase__execute_sql` with `project_id: "wyzcnkdonbdykidmcxvx"` and:

```sql
select name, public.dog_is_baseline_verified(id) from public.dogs where name in ('Fixture Dog A', 'Fixture Dog B');
```

Expected: both rows show `true`.

- [ ] **Step 5: Add Owner B's credentials to `.env.local`**

Add to `.env.local`:

```
E2E_FIXTURE_B_EMAIL=e2e-fixture-owner-b@gmail.com
E2E_FIXTURE_B_PASSWORD=testpassword123
```

- [ ] **Step 6: Write the failing e2e test**

```typescript
// tests/e2e/browse-and-match-flow.spec.ts
import { test, expect, chromium } from '@playwright/test'

test('two verified owners browse, express mutual interest, and see a match', async () => {
  const emailA = process.env.E2E_FIXTURE_EMAIL
  const passwordA = process.env.E2E_FIXTURE_PASSWORD
  const emailB = process.env.E2E_FIXTURE_B_EMAIL
  const passwordB = process.env.E2E_FIXTURE_B_PASSWORD
  if (!emailA || !passwordA || !emailB || !passwordB) {
    throw new Error('E2E fixture env vars must be set in .env.local')
  }

  const browser = await chromium.launch()
  const contextA = await browser.newContext({ baseURL: 'http://localhost:3000' })
  const contextB = await browser.newContext({ baseURL: 'http://localhost:3000' })
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await pageA.goto('/login')
  await pageA.fill('input[name="email"]', emailA)
  await pageA.fill('input[name="password"]', passwordA)
  await pageA.click('button[type="submit"]')
  await expect(pageA).toHaveURL(/\/dashboard/)

  await pageB.goto('/login')
  await pageB.fill('input[name="email"]', emailB)
  await pageB.fill('input[name="password"]', passwordB)
  await pageB.click('button[type="submit"]')
  await expect(pageB).toHaveURL(/\/dashboard/)

  // Owner A browses and finds Owner B's dog
  await pageA.goto('/browse')
  await expect(pageA.locator('text=Fixture Dog B')).toBeVisible()
  await pageA.click('text=Fixture Dog B')
  await expect(pageA).toHaveURL(/\/dogs\//)
  await pageA.click('button:has-text("Express Interest")')
  await expect(pageA.locator('text=Interest expressed!')).toBeVisible()

  // Owner B browses and finds Owner A's dog, expresses interest back
  await pageB.goto('/browse')
  await expect(pageB.locator('text=Fixture Dog A')).toBeVisible()
  await pageB.click('text=Fixture Dog A')
  await expect(pageB).toHaveURL(/\/dogs\//)
  await pageB.click('button:has-text("Express Interest")')
  await expect(pageB.locator('text=Interest expressed!')).toBeVisible()

  // Both should now see a match
  await pageA.goto('/matches')
  await expect(pageA.locator('text=Fixture Dog A')).toBeVisible()
  await expect(pageA.locator('text=Fixture Dog B')).toBeVisible()

  await pageB.goto('/matches')
  await expect(pageB.locator('text=Fixture Dog A')).toBeVisible()
  await expect(pageB.locator('text=Fixture Dog B')).toBeVisible()

  await browser.close()
})
```

- [ ] **Step 7: Run the test**

Run: `npx playwright test browse-and-match-flow`
Expected: `1 passed`. If it fails, re-run Step 4's verification query first — a common cause is the seed data not matching (e.g. re-running Step 3 after dogs already exist inserts duplicates since there's no unique constraint on dog name; if so, delete the extras with `delete from public.dogs where name in (...) and id not in (select min(id) ...)` before retrying, or query the existing dog ids and skip re-seeding).

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/browse-and-match-flow.spec.ts
git commit -m "Add e2e test for browse -> express interest -> mutual match flow"
```

---

## Self-Review Notes

**Spec coverage:** owner location + geolocation consent (Task 1), public dog browsing with limited columns (Task 2 view), search/filters incl. distance radius (Task 2 RPC, Task 3 page), baseline-verified gating on interest (Task 4 RLS), mutual match auto-creation (Task 4 trigger), Express Interest UI with the disabled/explained states the spec calls for (Task 5), `/matches` page with the "chat coming later" / no-party-to-arrangement disclaimers (Task 6) — all covered. Chat, education hub, admin UI polish, donations, vet-referral, breeding-outcome tracking, native mobile, and Apple Sign-In remain explicitly out of scope per the original spec.

**Deviation from the spec's testing section:** the spec calls for a Vitest test of the interest→match trigger "against a test Supabase branch." No such Vitest/DB-integration pattern exists anywhere in this codebase yet (existing Vitest tests are pure-logic: schema validation, EXIF stripping) — DB behavior has only ever been verified via Playwright e2e (Task 10's `health-verification-flow.spec.ts`). Task 7 follows that established precedent instead of introducing a new test-infra pattern for one function.

**Security note found but out of scope:** `owners_update_own` RLS (migration 0001) has no `with check`, meaning an authenticated user can currently `PATCH` their own `is_admin` column to `true` directly via the REST API. This plan's location-update code only ever writes `location_point`/`location_label` and never touches `is_admin`, so it doesn't make the gap worse — but it's a real, pre-existing privilege-escalation hole worth a dedicated follow-up plan. Flagged to the user separately rather than folded into this browse/matching work.

**Type consistency checked:** `browse_dogs`'s returned column names (`breed_name`, `location_label`, `distance_miles`, `owner_id`) match what `app/browse/page.tsx` destructures; `dogs_browsable`'s columns (`breed_name`) match what `app/dogs/[id]/page.tsx`'s browsable branch reads; `ExpressInterestForm`'s `MyDog` shape (`id, name, isVerified`) matches what the dog detail page constructs via `Promise.all` over `dog_is_baseline_verified`; the Postgres error code `23505` (unique violation) used in `ExpressInterestForm` matches the `dog_interests_unique` constraint from Task 4.
