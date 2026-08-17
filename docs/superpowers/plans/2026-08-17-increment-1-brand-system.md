# Increment 1 — Brand System and Landing Rebrand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a reusable brand vocabulary — semantic CSS classes, a `Logo`, and a shared `SiteHeader` — and apply it to the landing page and footer.

**Architecture:** Brand identity is centralised in `@layer components` classes in `globals.css` so that rebranding any page is a class swap, not a redesign. Nav links are plain data in `lib/nav.ts` so the link set is unit-testable without rendering React. `SiteHeader` is a pure function of its props — it fetches nothing.

**Tech Stack:** Next.js 15 App Router, Tailwind 3.4, React 19, Vitest + Testing Library.

## Global Constraints

- Palette is already defined in `tailwind.config.ts`: `brand` `#2F6B5C` / `brand-dark` `#245448` / `brand-soft` `#E3EFE9`; `accent` `#E8734A` / `accent-dark` `#C95A33` / `accent-soft` `#FDEEE7`; `ivory` `#FBF7F0`; `ink` `#26221C` / `ink-soft` `#6C6155`. Do not add new colours.
- Fonts are already wired: `font-display` (Fraunces) for headings, `font-body` (Nunito) for body.
- The 🐾 emoji stays as a decorative accent. `public/logo.svg` is the mark. Both are in use.
- Section ids on the landing page — `#how`, `#health`, `#roadmap`, `#faq`, `#signin`, `#waitlist` — must not change. They are linked from the footer, the sticky bar, and indexed URLs.
- No behaviour changes in this increment. Presentation only.
- Every decorative emoji gets `aria-hidden="true"`.

---

### Task 1: Nav model

**Files:**
- Create: `lib/nav.ts`
- Test: `tests/unit/nav.test.ts`
- Modify: `vitest.config.ts` (widen include glob to `.tsx` for Task 3)

**Interfaces:**
- Produces: `type NavVariant = 'public' | 'member'`; `type NavLink = { href: string; label: string }`; `navLinks(variant: NavVariant): NavLink[]`; `isActive(href: string, pathname: string): boolean`

- [ ] **Step 1: Widen the vitest include glob**

`vitest.config.ts` currently matches only `.ts`, so the component test in Task 3 would be silently skipped.

```ts
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
```

- [ ] **Step 2: Write the failing test**

`tests/unit/nav.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { navLinks, isActive } from '@/lib/nav'

describe('navLinks', () => {
  it('gives the public variant on-page anchors', () => {
    expect(navLinks('public').map((l) => l.href)).toEqual(['#how', '#health', '#roadmap', '#faq'])
  })

  it('gives the member variant real routes', () => {
    expect(navLinks('member').map((l) => l.href)).toEqual([
      '/home',
      '/browse',
      '/matches',
      '/settings',
    ])
  })
})

describe('isActive', () => {
  it('matches an exact route', () => {
    expect(isActive('/browse', '/browse')).toBe(true)
  })

  it('matches a nested route', () => {
    expect(isActive('/matches', '/matches/abc-123')).toBe(true)
  })

  it('does not treat a prefix of a longer segment as nested', () => {
    expect(isActive('/match', '/matches')).toBe(false)
  })

  it('never marks an anchor active', () => {
    expect(isActive('#how', '/')).toBe(false)
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run tests/unit/nav.test.ts`
Expected: FAIL — cannot resolve `@/lib/nav`.

- [ ] **Step 4: Implement**

`lib/nav.ts`:

```ts
export type NavVariant = 'public' | 'member'

export type NavLink = { href: string; label: string }

const PUBLIC_LINKS: NavLink[] = [
  { href: '#how', label: 'How It Works' },
  { href: '#health', label: 'Health First' },
  { href: '#roadmap', label: 'Roadmap' },
  { href: '#faq', label: 'FAQ' },
]

const MEMBER_LINKS: NavLink[] = [
  { href: '/home', label: 'Home' },
  { href: '/browse', label: 'Browse' },
  { href: '/matches', label: 'Matches' },
  { href: '/settings', label: 'Settings' },
]

export function navLinks(variant: NavVariant): NavLink[] {
  return variant === 'public' ? PUBLIC_LINKS : MEMBER_LINKS
}

/**
 * Nested routes count as active, so /matches stays lit while reading a thread.
 * The trailing-slash check stops /match from matching /matches.
 */
export function isActive(href: string, pathname: string): boolean {
  if (href.startsWith('#')) return false
  if (pathname === href) return true
  return pathname.startsWith(`${href}/`)
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run tests/unit/nav.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/nav.ts tests/unit/nav.test.ts vitest.config.ts
git commit -m "feat(nav): nav link model with active-route matching"
```

---

### Task 2: Brand component classes and Logo

**Files:**
- Modify: `app/globals.css`
- Create: `components/Logo.tsx`

**Interfaces:**
- Produces: CSS classes `.fp-btn`, `.fp-btn-accent`, `.fp-btn-ghost`, `.fp-card`, `.fp-band`, `.fp-link`, `.fp-badge`; component `Logo({ size, withWordmark }: { size?: 'sm' | 'md' | 'lg'; withWordmark?: boolean })`

- [ ] **Step 1: Add the component layer**

Append to `app/globals.css`:

```css
@layer components {
  .fp-btn {
    @apply inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5
           font-body font-bold text-ivory transition-colors hover:bg-brand-dark
           focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
           focus-visible:outline-brand;
  }
  .fp-btn-accent {
    @apply inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5
           font-body font-bold text-ivory transition-colors hover:bg-accent-dark
           focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
           focus-visible:outline-accent;
  }
  .fp-btn-ghost {
    @apply inline-flex items-center justify-center rounded-lg border-2 border-brand
           bg-transparent px-5 py-2.5 font-body font-bold text-brand transition-colors
           hover:bg-brand-soft focus-visible:outline focus-visible:outline-2
           focus-visible:outline-offset-2 focus-visible:outline-brand;
  }
  .fp-card {
    @apply rounded-xl border border-brand/15 bg-white p-5 shadow-sm;
  }
  .fp-band {
    @apply rounded-2xl bg-ivory p-8;
  }
  .fp-link {
    @apply text-brand underline underline-offset-2 hover:text-brand-dark;
  }
  .fp-badge {
    @apply inline-flex items-center rounded-full bg-brand-soft px-2.5 py-0.5
           text-xs font-bold text-brand-dark;
  }
}
```

Note: `border-brand/15` requires the opacity modifier, which Tailwind 3.4 supports on
arbitrary theme colours. No config change needed.

- [ ] **Step 2: Verify the classes compile**

Run: `npx next build`
Expected: build succeeds. An `@apply` of a non-existent utility fails the build loudly, so a clean build is the check here.

- [ ] **Step 3: Create the Logo component**

`components/Logo.tsx`:

```tsx
import { SITE_NAME } from '@/lib/site'

const SIZES = { sm: 24, md: 32, lg: 48 } as const

/**
 * The paw mark, inline rather than <Image>, so it costs no request and scales
 * cleanly in a header that renders on every page.
 *
 * Kept in sync with public/logo.svg, which is still the favicon.
 */
export default function Logo({
  size = 'md',
  withWordmark = false,
}: {
  size?: keyof typeof SIZES
  withWordmark?: boolean
}) {
  const px = SIZES[size]
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        width={px}
        height={px}
        role="img"
        aria-label={`${SITE_NAME} logo`}
      >
        <circle cx="32" cy="32" r="30" fill="#2F6B5C" />
        <ellipse
          cx="19.5"
          cy="24.5"
          rx="5.2"
          ry="6.8"
          fill="#FBF7F0"
          transform="rotate(-20 19.5 24.5)"
        />
        <ellipse cx="32" cy="19.5" rx="5.4" ry="7" fill="#FBF7F0" />
        <ellipse
          cx="44.5"
          cy="24.5"
          rx="5.2"
          ry="6.8"
          fill="#FBF7F0"
          transform="rotate(20 44.5 24.5)"
        />
        <path
          d="M32 49.5 C25.4 44.6 20.8 40.3 20.8 35.3 C20.8 31.6 23.7 29 26.9 29 C28.9 29 30.8 30 32 31.7 C33.2 30 35.1 29 37.1 29 C40.3 29 43.2 31.6 43.2 35.3 C43.2 40.3 38.6 44.6 32 49.5 Z"
          fill="#E8734A"
        />
      </svg>
      {withWordmark && (
        <span className="font-display text-lg font-bold text-ink">{SITE_NAME}</span>
      )}
    </span>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/Logo.tsx
git commit -m "feat(brand): fp-* component classes and inline Logo mark"
```

---

### Task 3: SiteHeader

**Files:**
- Create: `components/SiteHeader.tsx`
- Test: `tests/unit/site-header.test.tsx`

**Interfaces:**
- Consumes: `navLinks`, `isActive` from `lib/nav.ts`; `Logo` from `components/Logo.tsx`
- Produces: `SiteHeader({ variant, pathname, unreadCount, displayName }: { variant: NavVariant; pathname?: string; unreadCount?: number; displayName?: string | null })`

- [ ] **Step 1: Write the failing test**

`tests/unit/site-header.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SiteHeader from '@/components/SiteHeader'

describe('SiteHeader', () => {
  it('shows marketing anchors and a join CTA in the public variant', () => {
    render(<SiteHeader variant="public" />)
    expect(screen.getByRole('link', { name: 'How It Works' })).toHaveAttribute('href', '#how')
    expect(screen.getByRole('link', { name: /join/i })).toHaveAttribute('href', '/signup')
  })

  it('shows member routes in the member variant', () => {
    render(<SiteHeader variant="member" pathname="/home" />)
    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/browse')
  })

  it('hides the unread badge at zero', () => {
    render(<SiteHeader variant="member" pathname="/home" unreadCount={0} />)
    expect(screen.queryByTestId('unread-badge')).toBeNull()
  })

  it('announces the unread count as text, not a bare dot', () => {
    render(<SiteHeader variant="member" pathname="/home" unreadCount={3} />)
    expect(screen.getByTestId('unread-badge')).toHaveTextContent('3 unread')
  })

  it('marks the current section active', () => {
    render(<SiteHeader variant="member" pathname="/matches/abc" />)
    expect(screen.getByRole('link', { name: 'Matches' })).toHaveAttribute('aria-current', 'page')
  })
})
```

- [ ] **Step 2: Add the jest-dom matchers setup**

`toHaveAttribute` and `toHaveTextContent` come from `@testing-library/jest-dom`, which is
installed but not registered. Add to `vitest.config.ts`:

```ts
    setupFiles: ['./tests/setup.ts'],
```

Create `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run tests/unit/site-header.test.tsx`
Expected: FAIL — cannot resolve `@/components/SiteHeader`.

- [ ] **Step 4: Implement**

`components/SiteHeader.tsx`:

```tsx
import Link from 'next/link'
import Logo from './Logo'
import { navLinks, isActive, type NavVariant } from '@/lib/nav'

/**
 * The one header for every page.
 *
 * Deliberately a pure function of its props — it reads no session and runs no
 * query, so it renders identically in a test and in a server component, and the
 * caller (which already holds a Supabase client) decides what is true.
 */
export default function SiteHeader({
  variant,
  pathname = '/',
  unreadCount = 0,
  displayName = null,
}: {
  variant: NavVariant
  pathname?: string
  unreadCount?: number
  displayName?: string | null
}) {
  const links = navLinks(variant)

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 py-4">
      <Link href={variant === 'member' ? '/home' : '/'} className="shrink-0">
        <Logo size="md" withWordmark />
      </Link>

      <nav aria-label="Main" className="flex flex-wrap items-center gap-4 text-sm">
        {links.map((link) => {
          const active = isActive(link.href, pathname)
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'font-bold text-brand-dark'
                  : 'text-ink-soft hover:text-brand-dark hover:underline'
              }
            >
              {link.label}
              {link.href === '/matches' && unreadCount > 0 && (
                <span data-testid="unread-badge" className="fp-badge ml-1.5">
                  {unreadCount} unread
                </span>
              )}
            </Link>
          )
        })}

        {variant === 'public' ? (
          <Link href="/signup" className="fp-btn px-4 py-2 text-sm">
            Join free
          </Link>
        ) : (
          displayName && <span className="text-sm text-ink-soft">{displayName}</span>
        )}
      </nav>
    </header>
  )
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run tests/unit/site-header.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Run the whole suite for regressions**

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add components/SiteHeader.tsx tests/unit/site-header.test.tsx tests/setup.ts vitest.config.ts
git commit -m "feat(brand): shared SiteHeader with public and member variants"
```

---

### Task 4: Rebrand the landing page and footer

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/SiteFooter.tsx`
- Modify: `components/StickyJoinBar.tsx`
- Modify: `app/layout.tsx:40` (body background)

**Interfaces:**
- Consumes: `SiteHeader`, `Logo`, and the `fp-*` classes from Tasks 1–3.

- [ ] **Step 1: Swap the body background to ivory**

`app/layout.tsx`, the `<body>` className:

```tsx
      <body className="min-h-screen bg-ivory font-body text-ink">
```

- [ ] **Step 2: Replace the landing page's inline header**

In `app/page.tsx`, delete the `<header>` block (lines 100–119) and its now-unused
`signedIn`-conditional chip, replacing it with:

```tsx
      <SiteHeader variant="public" />
```

Add the import: `import SiteHeader from '@/components/SiteHeader'`.

The signed-in "Dashboard" affordance is not lost — the `#signin` panel at
`app/page.tsx:178` already renders a "Go to your dashboard" button when `signedIn`.

- [ ] **Step 3: Swap the landing page's colour classes**

Apply throughout `app/page.tsx`:

| From | To |
|---|---|
| `rounded bg-gray-900 px-6 py-3 font-semibold text-white` | `fp-btn` |
| `rounded bg-gray-900 px-5 py-2 font-semibold text-white` | `fp-btn` |
| `rounded border px-6 py-3 font-semibold` | `fp-btn-ghost` |
| `rounded border px-5 py-2 font-semibold` | `fp-btn-ghost` |
| `rounded-lg border p-5` | `fp-card` |
| `rounded-lg border bg-gray-50 p-8` | `fp-band` |
| `text-gray-600` | `text-ink-soft` |
| `text-gray-500` | `text-ink-soft` |
| `bg-gray-900` (the step number circle) | `bg-brand` |
| `underline` (bare inline links) | `fp-link` |

Headings pick up Fraunces automatically from the `h1, h2, h3` base rule.

- [ ] **Step 4: Add the paw accent to section headings**

The 🐾 stays, as agreed. On the `#how` and `#health` headings only — enough to be
playful, not enough to be noise:

```tsx
        <h2 className="text-2xl font-bold">
          <span aria-hidden="true">🐾</span> How Forming Paws works
        </h2>
```

- [ ] **Step 5: Rebrand the footer**

In `components/SiteFooter.tsx`: `text-gray-600` → `text-ink-soft`, `underline` →
`fp-link`, and replace the leading 🐾 with `<Logo size="sm" />` beside the name — the
emoji already appears on the landing sections, and the footer is where the real mark
belongs.

- [ ] **Step 6: Rebrand the sticky join bar**

In `components/StickyJoinBar.tsx`, swap its button to `fp-btn` and its surface to
`bg-ivory` with a `border-brand/15` top border.

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit
npm test
npm run lint
npx next build
```

Expected: all four clean.

- [ ] **Step 8: Check the page renders at both widths**

Run `npm run dev`, open `http://localhost:3000`, and confirm at 375px and 1280px:
the header shows the paw mark, buttons are brand green, section bands are ivory, and
every anchor in the header still jumps to its section.

**Stop the dev server with `lsof -ti:3000 | xargs kill -9`** — `pkill -f "next start"`
kills the npm wrapper and leaves the child serving stale output, which has cost hours on
this repo before.

- [ ] **Step 9: Commit**

```bash
git add app/page.tsx app/layout.tsx components/SiteFooter.tsx components/StickyJoinBar.tsx
git commit -m "feat(brand): rebrand landing page, footer and sticky bar"
```

---

## Self-Review

**Spec coverage:** Increment 1 of the spec lists the component layer (Task 2), `Logo`
(Task 2), `SiteHeader` with two variants (Task 3), `lib/nav.ts` as testable data
(Task 1), the landing rebrand preserving section ids (Task 4), and the footer rebrand
(Task 4). All covered.

**Placeholders:** None. Every step carries its code or its exact command.

**Type consistency:** `NavVariant` is defined in Task 1 and consumed by Task 3 under the
same name. `navLinks` and `isActive` signatures match between definition and use.
`Logo`'s `size` prop is `keyof typeof SIZES` in Task 2 and called with `"md"` / `"sm"`
in Tasks 3 and 4, both valid keys.

**Known follow-on:** the member variant links to `/home` and `/settings`, which do not
exist until Increments 2 and 3. `SiteHeader variant="member"` is therefore not rendered
by any page in this increment — only the public variant is wired up. Task 3's test
covers the member variant so it is ready when those routes land.
