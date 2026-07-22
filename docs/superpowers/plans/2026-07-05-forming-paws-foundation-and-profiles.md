# Forming Paws — Foundation, Auth & Health-Verified Dog Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working Next.js + Supabase app where an owner can sign up, create dog profiles with photos, upload health documents, and get those documents verified by an admin — the core "no matching without verified health docs" value prop, deployed and demoable.

**Architecture:** Next.js 15 App Router (TypeScript, Tailwind) on Vercel; Supabase (Postgres + Auth + Storage) as the backend, driven via the Supabase MCP tools rather than a local CLI. Every table uses row-level security. This plan implements the first half of `docs/superpowers/specs/2026-07-05-forming-paws-phase2-slice1-design.md` — search/browse/matching (the spec's other half) is a separate follow-up plan once this one ships, since this slice alone is independently demoable software.

**Tech Stack:** Next.js ^15.0.0, React ^19.0.0, TypeScript ^5.6.0, Tailwind CSS ^3.4.0, @supabase/supabase-js ^2.45.0, @supabase/ssr ^0.5.0, zod ^3.23.0, sharp ^0.33.0 (EXIF stripping), Vitest ^2.0.0 + @testing-library/react ^16.0.0, @playwright/test ^1.47.0.

## Global Constraints

- Row-level security on every table — no exceptions
- Health documents are private by default; only verification *status* is ever exposed to anyone other than the owning owner and an admin — never the document file
- Minors cannot register — signup requires an explicit 18+ attestation checkbox
- Breed selection is a structured dropdown sourced from a `breeds` table — never free text
- Photos: max 5 per dog, max 5MB per file, EXIF/GPS metadata stripped server-side before the file reaches Storage
- Auth is Supabase email/password + Google OAuth only — Apple Sign-In is explicitly deferred (costs $99/year, conflicts with the $0-capital constraint)
- Supabase project setup and migrations go through the Supabase MCP tools (`create_project`, `apply_migration`, `execute_sql`), not a local `supabase` CLI
- This is a **new, dedicated** Supabase project — never reuse or share the existing `fqdrvhpdntflfkqxlvkq` (The Plug AI) project
- No auto-approval of anything breeding-related is built in this slice (that logic doesn't exist yet — this plan only reaches "verified health docs," not matching)

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `.env.local.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a running Next.js dev server (`npm run dev`) and a passing production build (`npm run build`) — every later task depends on this scaffold existing.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "forming-paws-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0",
    "zod": "^3.23.0",
    "sharp": "^0.33.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0",
    "vitest": "^2.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "jsdom": "^25.0.0",
    "@playwright/test": "^1.47.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

- [ ] **Step 4: Write `postcss.config.mjs`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 5: Write `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}

export default config
```

- [ ] **Step 6: Write `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Write `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Forming Paws',
  description: 'Health-first, safety-first dog breeding matchmaking',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">{children}</body>
    </html>
  )
}
```

- [ ] **Step 8: Write `app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold">Forming Paws</h1>
      <p className="mt-2 text-gray-600">Health-first, safety-first dog breeding matchmaking.</p>
    </main>
  )
}
```

- [ ] **Step 9: Write `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 10: Update `.gitignore`**

```
node_modules/
.next/
.env.local
test-results/
playwright-report/
```

- [ ] **Step 11: Install dependencies and verify the build**

Run: `npm install && npm run build`
Expected: build completes with `✓ Compiled successfully` and no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
git add package.json tsconfig.json next.config.ts postcss.config.mjs tailwind.config.ts app .env.local.example .gitignore package-lock.json
git commit -m "Scaffold Next.js + Tailwind project"
```

---

### Task 2: Supabase project creation

**Files:**
- Create: `.env.local` (untracked — real credentials, never committed)
- Create: `supabase/migrations/` (directory, tracked SQL history)

**Interfaces:**
- Produces: a live Supabase project with its URL and anon key recorded in `.env.local`, and every later migration task applies its SQL both via the Supabase MCP `apply_migration` tool (so it actually runs) and as a numbered file in `supabase/migrations/` (so there's a reviewable history).

- [ ] **Step 1: Create the Supabase project via MCP**

Call `mcp__claude_ai_Supabase__create_project` with `name: "forming-paws"`, choosing a region close to Chicago (`us-east-1` or `us-east-2` if offered) and the organization used for Stefan's other projects (`bzfkpjuuvgojgaqbqcii`, confirm via `mcp__claude_ai_Supabase__list_organizations` first — do not reuse or write into the existing `fqdrvhpdntflfkqxlvkq` project).

Expected: a new project ID distinct from `fqdrvhpdntflfkqxlvkq`, `dyoveisuiynyzurfjjhk`, and `usotzurjnfnpejyoywvj`.

- [ ] **Step 2: Fetch the project URL and anon key**

Call `mcp__claude_ai_Supabase__get_project_url` and `mcp__claude_ai_Supabase__get_publishable_keys` with the new project ID.

- [ ] **Step 3: Write `.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=<url from Step 2>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Step 2>
```

- [ ] **Step 4: Create the migrations directory**

Run: `mkdir -p supabase/migrations`

- [ ] **Step 5: Verify `.env.local` is gitignored**

Run: `git check-ignore .env.local`
Expected: prints `.env.local` (confirms it will not be committed).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/.gitkeep 2>/dev/null; mkdir -p supabase/migrations && touch supabase/migrations/.gitkeep
git add supabase/migrations/.gitkeep
git commit -m "Add Supabase migrations directory (project created via MCP, credentials in untracked .env.local)"
```

---

### Task 3: `owners` and `breeds` tables

**Files:**
- Create: `supabase/migrations/0001_owners_and_breeds.sql`
- Create: `lib/breeds.json`
- Test: run the verification queries in Step 4 below via `mcp__claude_ai_Supabase__execute_sql`

**Interfaces:**
- Produces: `public.owners(id, display_name, is_admin, created_at)`, `public.breeds(id, name)`, and a trigger that auto-inserts an `owners` row when a new `auth.users` row is created. Later tasks (`dogs`, `health_documents`) reference `owners.id` and `breeds.id`.

- [ ] **Step 1: Write `supabase/migrations/0001_owners_and_breeds.sql`**

```sql
create table public.owners (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.owners enable row level security;

create policy "owners_select_own" on public.owners
  for select using (auth.uid() = id);

create policy "owners_update_own" on public.owners
  for update using (auth.uid() = id);

create table public.breeds (
  id bigint generated always as identity primary key,
  name text not null unique
);

alter table public.breeds enable row level security;

create policy "breeds_select_all" on public.breeds
  for select to authenticated using (true);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.owners (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Apply the migration via MCP**

Call `mcp__claude_ai_Supabase__apply_migration` with `name: "owners_and_breeds"` and the SQL from Step 1 against the Forming Paws project.

- [ ] **Step 3: Write `lib/breeds.json`** (structured breed list — no free-text breed entry anywhere in the app)

```json
[
  "Labrador Retriever", "German Shepherd", "Golden Retriever", "French Bulldog",
  "Bulldog", "Poodle", "Beagle", "Rottweiler", "German Shorthaired Pointer",
  "Dachshund", "Pembroke Welsh Corgi", "Australian Shepherd", "Yorkshire Terrier",
  "Boxer", "Cavalier King Charles Spaniel", "Great Dane", "Miniature Schnauzer",
  "Doberman Pinscher", "Siberian Husky", "Boston Terrier", "Bernese Mountain Dog",
  "Pomeranian", "Havanese", "Shih Tzu", "Brittany", "English Springer Spaniel",
  "Cane Corso", "Miniature American Shepherd", "Border Collie", "Vizsla",
  "Chihuahua", "Basset Hound", "Belgian Malinois", "Mastiff", "Collie",
  "Newfoundland", "Rhodesian Ridgeback", "West Highland White Terrier",
  "Shetland Sheepdog", "Weimaraner", "Bloodhound", "Maltese", "Papillon",
  "Bull Terrier", "Akita", "Chesapeake Bay Retriever", "St. Bernard",
  "Australian Cattle Dog", "Portuguese Water Dog", "Bichon Frise", "Whippet",
  "Mixed Breed / Not Listed"
]
```

(52 seed breeds covering the AKC's most-registered list plus a "Mixed Breed / Not Listed" catch-all — expand later without a schema change, since it's just data.)

- [ ] **Step 4: Seed `breeds` from the JSON file and verify RLS**

Call `mcp__claude_ai_Supabase__execute_sql` with an `insert into public.breeds (name) values (...)` statement built from every entry in `lib/breeds.json` (use `on conflict (name) do nothing` so this is safe to re-run).

Then verify RLS with two checks via `execute_sql`:
```sql
select count(*) from public.breeds;
```
Expected: `52`.

```sql
select tablename, policyname, cmd from pg_policies where tablename in ('owners', 'breeds') order by tablename;
```
Expected: rows for `owners_select_own` (SELECT), `owners_update_own` (UPDATE), `breeds_select_all` (SELECT) — no INSERT/DELETE policy on `breeds` (confirms only the service role, never a regular user, can write breed data).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_owners_and_breeds.sql lib/breeds.json
git commit -m "Add owners and breeds tables with RLS, seed breed list"
```

---

### Task 4: Auth — Supabase SSR clients, signup, login

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`
- Create: `app/(auth)/signup/page.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/auth/callback/route.ts`
- Test: `tests/unit/signup-validation.test.ts`

**Interfaces:**
- Produces: `createClient()` (browser, from `lib/supabase/client.ts`) and `createClient()` (server, from `lib/supabase/server.ts`, async — must be awaited) — every later page that needs Supabase imports one of these two. Also produces the `signupSchema` zod schema (exported from `app/(auth)/signup/schema.ts`, not `page.tsx` — Next.js's page-export-shape check rejects named exports from any `page.tsx`, including `'use client'` ones, so the schema was split into its own file; `page.tsx` imports it from `./schema`) enforcing the 18+ attestation.

- [ ] **Step 1: Write `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Write `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore because
            // middleware.ts below refreshes the session on every request.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Write `middleware.ts`** (refreshes the auth session cookie on every request)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 4: Write the failing test — `tests/unit/signup-validation.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { signupSchema } from '@/app/(auth)/signup/page'

describe('signupSchema', () => {
  it('rejects signup without the 18+ attestation', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test Owner',
      isAdult: false,
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid signup with the attestation checked', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test Owner',
      isAdult: true,
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run tests/unit/signup-validation.test.ts`
Expected: FAIL — `Cannot find module '@/app/(auth)/signup/page'` (the page doesn't exist yet).

- [ ] **Step 6: Write `app/(auth)/signup/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
  isAdult: z.literal(true, {
    errorMap: () => ({ message: 'You must confirm you are 18 or older' }),
  }),
})

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const parsed = signupSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
      displayName: formData.get('displayName'),
      isAdult: formData.get('isAdult') === 'on',
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { display_name: parsed.data.displayName } },
    })

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <form action={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input name="displayName" placeholder="Your name" required className="border p-2" />
        <input name="email" type="email" placeholder="Email" required className="border p-2" />
        <input name="password" type="password" placeholder="Password" required className="border p-2" />
        <label className="flex items-center gap-2 text-sm">
          <input name="isAdult" type="checkbox" />
          I confirm I am 18 years of age or older
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="bg-gray-900 text-white p-2 rounded">
          Sign up
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/unit/signup-validation.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Write `app/(auth)/login/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(formData.get('email')),
      password: String(formData.get('password')),
    })

    if (signInError) {
      setError(signInError.message)
      return
    }

    router.push('/dashboard')
  }

  async function handleGoogleLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form action={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input name="email" type="email" placeholder="Email" required className="border p-2" />
        <input name="password" type="password" placeholder="Password" required className="border p-2" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="bg-gray-900 text-white p-2 rounded">
          Log in
        </button>
      </form>
      <button onClick={handleGoogleLogin} className="mt-4 border p-2 rounded w-full">
        Continue with Google
      </button>
    </main>
  )
}
```

- [ ] **Step 9: Write `app/auth/callback/route.ts`** (OAuth redirect handler)

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
```

- [ ] **Step 10: Verify the full build still passes**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 11: Commit**

```bash
git add lib/supabase middleware.ts "app/(auth)" app/auth tests/unit/signup-validation.test.ts vitest.config.ts 2>/dev/null
git add lib/supabase middleware.ts "app/(auth)" app/auth tests/unit/signup-validation.test.ts
git commit -m "Add Supabase SSR auth: signup with 18+ attestation, login, Google OAuth"
```

**Note:** this task assumes `vitest.config.ts` exists — if `npx vitest` fails with a config error in Step 5, create it first:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

---

### Task 5: `dogs` table and dog profile CRUD

**Files:**
- Create: `supabase/migrations/0002_dogs.sql`
- Create: `lib/breeds.ts`
- Create: `app/dashboard/page.tsx`
- Create: `app/dogs/new/page.tsx`
- Create: `app/dogs/[id]/page.tsx`
- Test: `tests/unit/dog-schema.test.ts`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server.ts` and `lib/supabase/client.ts` (Task 4); `public.owners`/`public.breeds` (Task 3)
- Produces: `public.dogs(id, owner_id, name, breed_id, sex, birth_date, weight_lbs, temperament_notes, created_at)`; `dogSchema` (zod, exported from `app/dogs/new/NewDogForm.tsx`); `getBreeds()` (exported from `lib/breeds.ts`, returns `Promise<{id: number, name: string}[]>`) — used by both the new-dog form and (in a later task) the browse page.

**Note on structure:** `app/dogs/new/page.tsx` is a Next.js page — the router only ever calls it with `{ params, searchParams }`, never arbitrary custom props. So the breed list can't be passed in as a prop to the page itself. This task splits the route into an async Server Component (`page.tsx`, fetches breeds via `getBreeds()`) that renders a Client Component (`NewDogForm.tsx`, receives `breeds` as a real prop from its parent and owns the interactive form + validation).

- [ ] **Step 1: Write `supabase/migrations/0002_dogs.sql`**

```sql
create type public.dog_sex as enum ('male', 'female');

create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  name text not null,
  breed_id bigint not null references public.breeds(id),
  sex public.dog_sex not null,
  birth_date date not null,
  weight_lbs numeric(5,1),
  temperament_notes text,
  created_at timestamptz not null default now()
);

alter table public.dogs enable row level security;

create policy "dogs_select_own" on public.dogs
  for select using (owner_id = auth.uid());

create policy "dogs_insert_own" on public.dogs
  for insert with check (owner_id = auth.uid());

create policy "dogs_update_own" on public.dogs
  for update using (owner_id = auth.uid());

create policy "dogs_delete_own" on public.dogs
  for delete using (owner_id = auth.uid());
```

**Note:** `dogs_select_own` is deliberately scoped to the owner only in this plan — the follow-up Slice 2 plan (search/browse) will add a separate public-read view exposing a limited column set, rather than opening this table's SELECT policy to everyone now with no browse UI to justify it.

- [ ] **Step 2: Apply the migration via MCP**

Call `mcp__claude_ai_Supabase__apply_migration` with `name: "dogs"` and the SQL from Step 1.

- [ ] **Step 3: Write the failing test — `tests/unit/dog-schema.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { dogSchema } from '@/app/dogs/new/NewDogForm'

describe('dogSchema', () => {
  it('rejects a birth date in the future', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const result = dogSchema.safeParse({
      name: 'Rex',
      breedId: '1',
      sex: 'male',
      birthDate: tomorrow,
      weightLbs: '',
      temperamentNotes: '',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid dog profile', () => {
    const result = dogSchema.safeParse({
      name: 'Rex',
      breedId: '1',
      sex: 'male',
      birthDate: '2023-01-15',
      weightLbs: '65',
      temperamentNotes: 'Friendly, high energy',
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/unit/dog-schema.test.ts`
Expected: FAIL — `Cannot find module '@/app/dogs/new/NewDogForm'`.

- [ ] **Step 5: Write `lib/breeds.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'

export async function getBreeds() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('breeds').select('id, name').order('name')
  if (error) throw error
  return data as { id: number; name: string }[]
}
```

- [ ] **Step 6: Write `app/dogs/new/NewDogForm.tsx`** (client component — the interactive form)

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

export const dogSchema = z.object({
  name: z.string().min(1),
  breedId: z.string().min(1),
  sex: z.enum(['male', 'female']),
  birthDate: z.string().refine((d) => new Date(d) <= new Date(), {
    message: 'Birth date cannot be in the future',
  }),
  weightLbs: z.string().optional(),
  temperamentNotes: z.string().optional(),
})

export default function NewDogForm({ breeds }: { breeds: { id: number; name: string }[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const parsed = dogSchema.safeParse({
      name: formData.get('name'),
      breedId: formData.get('breedId'),
      sex: formData.get('sex'),
      birthDate: formData.get('birthDate'),
      weightLbs: formData.get('weightLbs'),
      temperamentNotes: formData.get('temperamentNotes'),
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setError('Not signed in')
      return
    }

    const { error: insertError } = await supabase.from('dogs').insert({
      owner_id: userData.user.id,
      name: parsed.data.name,
      breed_id: Number(parsed.data.breedId),
      sex: parsed.data.sex,
      birth_date: parsed.data.birthDate,
      weight_lbs: parsed.data.weightLbs ? Number(parsed.data.weightLbs) : null,
      temperament_notes: parsed.data.temperamentNotes || null,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-bold">Add a dog</h1>
      <form action={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input name="name" placeholder="Dog's name" required className="border p-2" />
        <select name="breedId" required className="border p-2">
          <option value="">Select breed</option>
          {breeds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="sex" required className="border p-2">
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <input name="birthDate" type="date" required className="border p-2" />
        <input name="weightLbs" type="number" placeholder="Weight (lbs)" className="border p-2" />
        <textarea name="temperamentNotes" placeholder="Temperament notes" className="border p-2" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="bg-gray-900 text-white p-2 rounded">
          Save
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/unit/dog-schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7b: Write `app/dogs/new/page.tsx`** (async Server Component — fetches breeds, renders the client form)

```tsx
import { getBreeds } from '@/lib/breeds'
import NewDogForm from './NewDogForm'

export default async function NewDogPage() {
  const breeds = await getBreeds()
  return <NewDogForm breeds={breeds} />
}
```

- [ ] **Step 8: Write `app/dashboard/page.tsx`** (server component — lists the signed-in owner's dogs)

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: dogs, error } = await supabase
    .from('dogs')
    .select('id, name, sex, birth_date, breeds(name)')
    .eq('owner_id', userData.user.id)

  if (error) throw error

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your dogs</h1>
        <Link href="/dogs/new" className="bg-gray-900 text-white px-4 py-2 rounded">
          Add a dog
        </Link>
      </div>
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

- [ ] **Step 9: Write `app/dogs/[id]/page.tsx`** (server component, profile detail — photos/health docs come in later tasks, this establishes the base page)

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

export default async function DogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: dog, error } = await supabase
    .from('dogs')
    .select('id, name, sex, birth_date, weight_lbs, temperament_notes, breeds(name)')
    .eq('id', id)
    .single()

  if (error || !dog) notFound()

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">{dog.name}</h1>
      <p className="text-gray-600">
        {(dog.breeds as unknown as { name: string })?.name} · {dog.sex} · born {dog.birth_date}
      </p>
      {dog.temperament_notes && <p className="mt-4">{dog.temperament_notes}</p>}
    </main>
  )
}
```

- [ ] **Step 10: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 11: Commit**

```bash
git add supabase/migrations/0002_dogs.sql lib/breeds.ts app/dashboard app/dogs tests/unit/dog-schema.test.ts
git commit -m "Add dogs table and owner-facing dog profile CRUD"
```

---

### Task 6: Photo upload with EXIF stripping

**Files:**
- Create: `supabase/migrations/0003_dog_photos.sql`
- Create: `lib/image.ts`
- Create: `app/api/upload/photo/route.ts`
- Modify: `app/dogs/[id]/page.tsx`
- Test: `tests/unit/image.test.ts`

**Interfaces:**
- Consumes: `public.dogs` (Task 5)
- Produces: `stripImageMetadata(buffer: Buffer): Promise<Buffer>` (exported from `lib/image.ts`) — a plain image-processing function with no Supabase dependency, so it's directly unit-testable; `public.dog_photos(id, dog_id, storage_path, position, created_at)`; a private Storage bucket named `dog-photos`.

- [ ] **Step 1: Write `supabase/migrations/0003_dog_photos.sql`**

```sql
create table public.dog_photos (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  storage_path text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.dog_photos enable row level security;

create policy "dog_photos_select_own" on public.dog_photos
  for select using (
    exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid())
  );

create policy "dog_photos_insert_own" on public.dog_photos
  for insert with check (
    exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid())
  );

create policy "dog_photos_delete_own" on public.dog_photos
  for delete using (
    exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid())
  );

insert into storage.buckets (id, name, public) values ('dog-photos', 'dog-photos', false)
on conflict (id) do nothing;

create policy "dog_photos_storage_owner_access" on storage.objects
  for all using (
    bucket_id = 'dog-photos'
    and exists (
      select 1 from public.dogs d
      where d.owner_id = auth.uid()
        and (storage.foldername(name))[1] = d.id::text
    )
  );
```

- [ ] **Step 2: Apply the migration via MCP**

Call `mcp__claude_ai_Supabase__apply_migration` with `name: "dog_photos"` and the SQL from Step 1.

- [ ] **Step 3: Write the failing test — `tests/unit/image.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { stripImageMetadata } from '@/lib/image'

describe('stripImageMetadata', () => {
  it('removes EXIF metadata from a JPEG buffer', async () => {
    const withExif = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .withMetadata({ exif: { IFD0: { Make: 'TestCamera' } } })
      .jpeg()
      .toBuffer()

    const stripped = await stripImageMetadata(withExif)
    const strippedMetadata = await sharp(stripped).metadata()

    expect(strippedMetadata.exif).toBeUndefined()
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/unit/image.test.ts`
Expected: FAIL — `Cannot find module '@/lib/image'`.

- [ ] **Step 5: Write `lib/image.ts`**

```typescript
import sharp from 'sharp'

const MAX_DIMENSION = 2000

export async function stripImageMetadata(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // apply orientation from EXIF before stripping it, so the image isn't sideways
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .withMetadata({ exif: {} })
    .toBuffer()
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/unit/image.test.ts`
Expected: PASS.

- [ ] **Step 7: Write `app/api/upload/photo/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { stripImageMetadata } from '@/lib/image'
import { NextResponse } from 'next/server'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_PHOTOS_PER_DOG = 5

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const formData = await request.formData()
  const dogId = String(formData.get('dogId'))
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 5MB limit' }, { status: 400 })
  }

  const { data: dog } = await supabase.from('dogs').select('owner_id').eq('id', dogId).single()
  if (!dog || dog.owner_id !== userData.user.id) {
    return NextResponse.json({ error: 'Not your dog' }, { status: 403 })
  }

  const { count } = await supabase
    .from('dog_photos')
    .select('id', { count: 'exact', head: true })
    .eq('dog_id', dogId)
  if ((count ?? 0) >= MAX_PHOTOS_PER_DOG) {
    return NextResponse.json({ error: 'Maximum 5 photos per dog' }, { status: 400 })
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer())
  const cleanBuffer = await stripImageMetadata(rawBuffer)
  const storagePath = `${dogId}/${crypto.randomUUID()}.jpg`

  const { error: uploadError } = await supabase.storage
    .from('dog-photos')
    .upload(storagePath, cleanBuffer, { contentType: 'image/jpeg' })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { error: insertError } = await supabase
    .from('dog_photos')
    .insert({ dog_id: dogId, storage_path: storagePath, position: count ?? 0 })
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ ok: true, storagePath })
}
```

- [ ] **Step 8: Modify `app/dogs/[id]/page.tsx`** to show the photo gallery and an upload form

Replace the file's contents with:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

export default async function DogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: dog, error } = await supabase
    .from('dogs')
    .select('id, name, sex, birth_date, weight_lbs, temperament_notes, breeds(name)')
    .eq('id', id)
    .single()

  if (error || !dog) notFound()

  const { data: photos } = await supabase
    .from('dog_photos')
    .select('id, storage_path')
    .eq('dog_id', id)
    .order('position')

  const photoUrls = await Promise.all(
    (photos ?? []).map(async (p) => {
      const { data } = await supabase.storage
        .from('dog-photos')
        .createSignedUrl(p.storage_path, 3600)
      return { id: p.id, url: data?.signedUrl }
    })
  )

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">{dog.name}</h1>
      <p className="text-gray-600">
        {(dog.breeds as unknown as { name: string })?.name} · {dog.sex} · born {dog.birth_date}
      </p>
      {dog.temperament_notes && <p className="mt-4">{dog.temperament_notes}</p>}

      <h2 className="mt-8 text-lg font-semibold">Photos</h2>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {photoUrls.map((p) =>
          p.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt={dog.name} className="rounded aspect-square object-cover" />
          ) : null
        )}
      </div>
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
    </main>
  )
}
```

- [ ] **Step 9: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/0003_dog_photos.sql lib/image.ts app/api/upload/photo app/dogs/[id]/page.tsx tests/unit/image.test.ts
git commit -m "Add photo upload with EXIF stripping, 5-photo/5MB limits, private storage bucket"
```

---

### Task 7: `health_documents` table and upload UI

**Files:**
- Create: `supabase/migrations/0004_health_documents.sql`
- Create: `app/api/upload/health-doc/route.ts`
- Modify: `app/dogs/[id]/page.tsx`
- Test: run the verification queries in Step 3 via `execute_sql`

**Interfaces:**
- Consumes: `public.dogs` (Task 5)
- Produces: `public.health_documents(id, dog_id, storage_path, doc_type, document_date, status, uploaded_at, reviewed_at, reviewer_notes)`, a private `health-docs` Storage bucket. Status starts at `'pending_review'` on insert — `'unverified'` is reserved for a future re-submission/reset flow and is not produced by this task's insert path.

- [ ] **Step 1: Write `supabase/migrations/0004_health_documents.sql`**

```sql
create type public.health_doc_type as enum ('vet_exam', 'vaccination', 'ofa', 'dna_panel');
create type public.health_doc_status as enum ('unverified', 'pending_review', 'verified', 'rejected');

create table public.health_documents (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  storage_path text not null,
  doc_type public.health_doc_type not null,
  document_date date not null,
  status public.health_doc_status not null default 'pending_review',
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_notes text
);

alter table public.health_documents enable row level security;

create policy "health_documents_select_own" on public.health_documents
  for select using (
    exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid())
  );

create policy "health_documents_insert_own" on public.health_documents
  for insert with check (
    exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid())
  );

create policy "health_documents_admin_select_all" on public.health_documents
  for select using (
    exists (select 1 from public.owners o where o.id = auth.uid() and o.is_admin)
  );

create policy "health_documents_admin_update" on public.health_documents
  for update using (
    exists (select 1 from public.owners o where o.id = auth.uid() and o.is_admin)
  );

insert into storage.buckets (id, name, public) values ('health-docs', 'health-docs', false)
on conflict (id) do nothing;

create policy "health_docs_storage_owner_access" on storage.objects
  for select using (
    bucket_id = 'health-docs'
    and (
      exists (
        select 1 from public.dogs d
        where d.owner_id = auth.uid() and (storage.foldername(name))[1] = d.id::text
      )
      or exists (select 1 from public.owners o where o.id = auth.uid() and o.is_admin)
    )
  );

create policy "health_docs_storage_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'health-docs'
    and exists (
      select 1 from public.dogs d
      where d.owner_id = auth.uid() and (storage.foldername(name))[1] = d.id::text
    )
  );
```

- [ ] **Step 2: Apply the migration via MCP**

Call `mcp__claude_ai_Supabase__apply_migration` with `name: "health_documents"` and the SQL from Step 1.

- [ ] **Step 3: Verify RLS**

Call `mcp__claude_ai_Supabase__execute_sql`:
```sql
select tablename, policyname, cmd from pg_policies where tablename = 'health_documents' order by cmd;
```
Expected: 4 rows — `health_documents_select_own` (SELECT), `health_documents_insert_own` (INSERT), `health_documents_admin_select_all` (SELECT), `health_documents_admin_update` (UPDATE). No DELETE policy (documents are never deleted, only rejected, preserving an audit trail).

- [ ] **Step 4: Write `app/api/upload/health-doc/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const VALID_DOC_TYPES = ['vet_exam', 'vaccination', 'ofa', 'dna_panel']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const formData = await request.formData()
  const dogId = String(formData.get('dogId'))
  const docType = String(formData.get('docType'))
  const documentDate = String(formData.get('documentDate'))
  const file = formData.get('file') as File | null

  if (!VALID_DOC_TYPES.includes(docType)) {
    return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 5MB limit' }, { status: 400 })
  }

  const { data: dog } = await supabase.from('dogs').select('owner_id').eq('id', dogId).single()
  if (!dog || dog.owner_id !== userData.user.id) {
    return NextResponse.json({ error: 'Not your dog' }, { status: 403 })
  }

  const extension = file.name.split('.').pop() || 'pdf'
  const storagePath = `${dogId}/${crypto.randomUUID()}.${extension}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('health-docs')
    .upload(storagePath, buffer, { contentType: file.type })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { error: insertError } = await supabase.from('health_documents').insert({
    dog_id: dogId,
    storage_path: storagePath,
    doc_type: docType,
    document_date: documentDate,
  })
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Modify `app/dogs/[id]/page.tsx`** to show health docs and an upload form — add this block just before the closing `</main>` tag, and add the corresponding data fetch alongside the existing `photos` query:

Add after the `photoUrls` fetch:
```tsx
  const { data: healthDocs } = await supabase
    .from('health_documents')
    .select('id, doc_type, document_date, status')
    .eq('dog_id', id)
    .order('uploaded_at', { ascending: false })
```

Add before `</main>`:
```tsx
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
```

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0004_health_documents.sql app/api/upload/health-doc app/dogs/[id]/page.tsx
git commit -m "Add health document upload with type/date, private storage, pending_review default"
```

---

### Task 8: `dog_is_baseline_verified` function

**Files:**
- Create: `supabase/migrations/0005_baseline_verified_function.sql`
- Modify: `app/dogs/[id]/page.tsx`
- Test: run the verification queries in Step 3 via `execute_sql`

**Interfaces:**
- Consumes: `public.health_documents` (Task 7)
- Produces: `public.dog_is_baseline_verified(p_dog_id uuid) returns boolean` — a single source of truth for "is this dog cleared for matching," reused unchanged by the follow-up Slice 2 plan's matching gate.

- [ ] **Step 1: Write `supabase/migrations/0005_baseline_verified_function.sql`**

```sql
create or replace function public.dog_is_baseline_verified(p_dog_id uuid)
returns boolean
language sql
stable
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
```

- [ ] **Step 2: Apply the migration via MCP**

Call `mcp__claude_ai_Supabase__apply_migration` with `name: "baseline_verified_function"` and the SQL from Step 1.

- [ ] **Step 3: Verify the function with real data**

Call `mcp__claude_ai_Supabase__execute_sql` to insert a test owner/dog/two health documents (one `vet_exam` dated today with `status = 'verified'`, one `vaccination` with `status = 'verified'`) directly (bypassing RLS via the SQL editor, which runs as the service role), then:
```sql
select public.dog_is_baseline_verified('<test-dog-id>');
```
Expected: `true`.

Then update the `vet_exam` row's `document_date` to 13 months ago and re-run the same query.
Expected: `false` (confirms the 12-month recency rule is enforced).

Clean up the test rows afterward:
```sql
delete from public.dogs where id = '<test-dog-id>';
```

- [ ] **Step 4: Modify `app/dogs/[id]/page.tsx`** to show a verification badge — add after fetching `healthDocs`:

```tsx
  const { data: isVerified } = await supabase.rpc('dog_is_baseline_verified', { p_dog_id: id })
```

Add right after the `<h1>{dog.name}</h1>` line:
```tsx
      {isVerified ? (
        <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mt-1">
          ✓ Baseline health verified
        </span>
      ) : (
        <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded mt-1">
          Health verification pending
        </span>
      )}
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0005_baseline_verified_function.sql app/dogs/[id]/page.tsx
git commit -m "Add dog_is_baseline_verified function and profile verification badge"
```

---

### Task 9: Admin review queue

**Files:**
- Create: `app/admin/review-queue/page.tsx`
- Create: `app/admin/review-queue/actions.ts`

**Interfaces:**
- Consumes: `public.health_documents`, `public.owners.is_admin` (Tasks 3, 7)
- Produces: a server action `reviewDocument(docId: string, decision: 'verified' | 'rejected', notes: string): Promise<void>`, exported from `app/admin/review-queue/actions.ts`.

- [ ] **Step 1: Write `app/admin/review-queue/actions.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function reviewDocument(
  docId: string,
  decision: 'verified' | 'rejected',
  notes: string
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('health_documents')
    .update({ status: decision, reviewed_at: new Date().toISOString(), reviewer_notes: notes || null })
    .eq('id', docId)

  if (error) throw error
  revalidatePath('/admin/review-queue')
}
```

- [ ] **Step 2: Write `app/admin/review-queue/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { reviewDocument } from './actions'

export default async function ReviewQueuePage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: owner } = await supabase
    .from('owners')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single()
  if (!owner?.is_admin) redirect('/dashboard')

  const { data: pendingDocs } = await supabase
    .from('health_documents')
    .select('id, doc_type, document_date, storage_path, dogs(name)')
    .eq('status', 'pending_review')
    .order('uploaded_at')

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Health document review queue</h1>
      <ul className="mt-6 flex flex-col gap-4">
        {pendingDocs?.map((doc) => (
          <li key={doc.id} className="border p-4 rounded">
            <p className="font-medium">
              {(doc.dogs as unknown as { name: string })?.name} — {doc.doc_type} ({doc.document_date})
            </p>
            <form
              action={async (formData: FormData) => {
                'use server'
                await reviewDocument(
                  doc.id,
                  formData.get('decision') as 'verified' | 'rejected',
                  String(formData.get('notes') || '')
                )
              }}
              className="mt-2 flex gap-2 items-center"
            >
              <input name="notes" placeholder="Notes (optional)" className="border p-1 text-sm flex-1" />
              <button name="decision" value="verified" className="bg-green-600 text-white px-3 py-1 rounded text-sm">
                Verify
              </button>
              <button name="decision" value="rejected" className="bg-red-600 text-white px-3 py-1 rounded text-sm">
                Reject
              </button>
            </form>
          </li>
        ))}
        {pendingDocs?.length === 0 && <p className="text-gray-500">Nothing pending review.</p>}
      </ul>
    </main>
  )
}
```

- [ ] **Step 3: Grant yourself admin access**

Call `mcp__claude_ai_Supabase__execute_sql`:
```sql
update public.owners set is_admin = true where id = (select id from auth.users where email = '<Stefan's real signup email>');
```
(Run this after Stefan has signed up once through `/signup` in Task 10's manual verification — his `auth.users` row must exist first.)

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add app/admin
git commit -m "Add admin health-document review queue"
```

---

### Task 10: End-to-end test and manual verification

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/health-verification-flow.spec.ts`

**Interfaces:**
- Consumes: the full app from Tasks 1–9 running locally on `http://localhost:3000`

- [ ] **Step 1: Write `playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
})
```

- [ ] **Step 2: Write `tests/e2e/health-verification-flow.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'

test('owner can sign up, add a dog, and upload a health document', async ({ page }) => {
  const uniqueEmail = `e2e-test-${Date.now()}@example.com`

  await page.goto('/signup')
  await page.fill('input[name="displayName"]', 'E2E Test Owner')
  await page.fill('input[name="email"]', uniqueEmail)
  await page.fill('input[name="password"]', 'testpassword123')
  await page.check('input[name="isAdult"]')
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL(/\/dashboard/)

  await page.click('text=Add a dog')
  await page.fill('input[name="name"]', 'Test Dog')
  await page.selectOption('select[name="breedId"]', { index: 1 })
  await page.selectOption('select[name="sex"]', 'male')
  await page.fill('input[name="birthDate"]', '2023-01-15')
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL(/\/dashboard/)
  await page.click('text=Test Dog')

  await expect(page.locator('text=Health verification pending')).toBeVisible()
})
```

- [ ] **Step 3: Install Playwright browsers**

Run: `npx playwright install chromium`

- [ ] **Step 4: Run the e2e test**

Run: `npx playwright test`
Expected: `1 passed`. (This requires `.env.local` to point at the live Forming Paws Supabase project from Task 2 — the dev server started by Playwright's `webServer` config reads it automatically.)

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e
git commit -m "Add end-to-end test for signup, dog profile creation, and health doc status"
```

---

### Task 11: Deploy to Netlify — SKIPPED (2026-07-22)

**Decision:** Not deploying to Netlify (or any hosted platform) for now — building and running locally only, nothing wired to an external deploy target. Revisit hosting once there's something worth putting in front of real users.

**Context (historical):** Switched from Vercel to Netlify 2026-07-08 — the Vercel account hit a billing/usage cap. Netlify's Node.js Functions runtime runs the `app/api/upload/photo/route.ts` handler (which depends on the native `sharp` binary) unchanged, unlike Cloudflare Pages' Workers runtime, which can't run native binaries.

**Files:**
- Create: `netlify.toml` (build command, publish dir, `@netlify/plugin-nextjs`)

- [ ] **Step 1: Install the Next.js runtime plugin**

Run: `npm install -D @netlify/plugin-nextjs`

- [ ] **Step 2: Write `netlify.toml`**

```toml
[build]
  command = "npm run build"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

- [ ] **Step 3: Connect the repo and deploy**

Via the Netlify CLI (`netlify init` from `~/forming-paws`, linking the GitHub repo) or the Netlify dashboard's "Import from Git" flow. Requires a Netlify account/login — confirm one exists before this step.

- [ ] **Step 4: Set production environment variables**

In the Netlify site's Environment variables settings, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the same values as `.env.local` from Task 2.

- [ ] **Step 5: Verify the production deployment**

Run `netlify status` / check the Netlify dashboard for a successful deploy, then visit the deployed URL and confirm the homepage loads.

- [ ] **Step 6: Update the vault Command Center**

Add the new Forming Paws Netlify URL and Supabase project to `~/Desktop/kai/09-SYSTEM/Command Center.md`'s "Live Websites & Apps" and "Active Projects" tables, and commit that change in the `kai` vault repo.

---

## Self-Review Notes

**Spec coverage:** owner accounts (Task 4), dog profiles (Task 5), photo upload with EXIF/size limits (Task 6), health doc upload + verification status (Task 7), `dog_is_baseline_verified` (Task 8), admin review queue (Task 9) — all covered. Search/filters and browse/match/express-interest are explicitly deferred to the follow-up Slice 2 plan per the design doc's own scoping, not missing from this one.

**Type consistency checked:** `createClient()` signature (sync in `client.ts`, async in `server.ts`) used consistently across Tasks 4–9; `dogSchema`/`signupSchema` field names match the form field `name` attributes that read them; `dog_is_baseline_verified`'s SQL parameter name (`p_dog_id`) matches the `.rpc('dog_is_baseline_verified', { p_dog_id: id })` call in Task 8.

**Bug caught and fixed during self-review:** Task 5 originally had `app/dogs/new/page.tsx` receiving `breeds` as a prop directly — but Next.js page components are only ever invoked by the router with `{ params, searchParams }`, so nothing would have populated that prop at runtime. Fixed by splitting into an async Server Component (`page.tsx`, fetches breeds via `getBreeds()`) rendering a Client Component (`NewDogForm.tsx`, owns the form/validation/submit logic and receives `breeds` as a real prop from its parent).

**Deferred to the Slice 2 plan (not gaps in this one):** public dog browsing (needs the limited-column view mentioned in Task 5's note), `dog_interests`/`matches` tables, geo/PostGIS, `/browse` and `/matches` pages.
