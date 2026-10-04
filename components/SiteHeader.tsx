import Link from 'next/link'
import Logo from './Logo'
import { navLinks, isActive, type NavVariant } from '@/lib/nav'
import { WHAT_WE_DO_SHORT } from '@/lib/positioning'

/**
 * The one header for every page.
 *
 * Deliberately a pure function of its props — it reads no session and runs no
 * query — so it renders identically in a test and in a server component, and the
 * caller (which already holds a Supabase client) stays the single source of
 * truth about who is signed in.
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
    /*
      `relative z-50` is not decoration, it is the only thing that makes this
      header clickable on the landing page.

      The worldflight stage is `position: fixed; inset: 0` at z-index 1, so it
      covers the entire viewport including this header. The header was static
      with z-index auto, which means it never entered the comparison and the
      poster won: document.elementFromPoint() over the "Log in" link returned
      IMG.sc-world__poster, and every nav link, "Log in" and "Join free" was
      dead on the one page every visitor lands on. Measured on production, so
      this had been shipped and live, silently -- there is no error, no console
      warning, and the links look perfectly normal.

      50 places it above the engine's stage (1), grain (3) and copy (20) and
      above this site's own fixed bars (z-40, MemberTabBar and StickyJoinBar),
      while staying under scrollcraft's chrome (60) so the 2px scroll-progress
      hairline still draws across the top edge. Nothing visual changes: the
      header has no background, so the flight still shows through behind it.
    */
    <header className="relative z-50 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4">
      <Link href={variant === 'member' ? '/home' : '/'} className="shrink-0">
        <Logo size="lg" withWordmark />
      </Link>

      <nav aria-label="Main" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:gap-x-4">
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
              {/*
                Spelled out rather than a bare number in a dot: a screen reader
                announcing "Matches 3" gives no clue what the 3 counts.
              */}
              {link.href === '/matches' && unreadCount > 0 && (
                <span data-testid="unread-badge" className="fp-badge ml-1.5">
                  {unreadCount} unread
                </span>
              )}
            </Link>
          )
        })}

        {variant === 'public' ? (
          <>
            {/*
              The way back in. Until the splash landed, the only sign-in route
              from the home page was the panel inside the hero — and that is now
              a scroll below the fold, so a returning member had no visible way
              to reach it from the top of any public page.
            */}
            <Link href="/login" className="text-ink-soft hover:text-brand-dark hover:underline">
              Log in
            </Link>
            <Link href="/signup" className="fp-btn px-4 py-2 text-sm">
              Join free
            </Link>
          </>
        ) : (
          <>
            {displayName && <span className="text-sm text-ink-soft">{displayName}</span>}
            {/*
              A form, not a link, and posting to the existing /auth/signout route
              rather than a new action. GET sign-out is a real bug: a crawler or a
              browser prefetching the link would silently end the session.
            */}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-sm text-ink-soft hover:text-brand-dark hover:underline"
              >
                Sign out
              </button>
            </form>
          </>
        )}
      </nav>

      {/*
        What this site is, on every public page, above the fold, with no scroll
        and no JavaScript.

        This is the first of the three places lib/positioning is rendered by
        rule. Visitors were reaching the site and asking what we actually do, and
        a visitor who bounces from the header never reaches the hero copy, let
        alone the band below it. The compressed form is used rather than the full
        sentence because the sentence wraps to three lines in this strip at
        390px, which is how a clarifying line turns into clutter.

        `w-full` so it takes its own row in the wrapping flex header instead of
        competing with the nav for horizontal space. Members do not get it: a
        signed-in owner knows what the site is, and the row would be permanent
        furniture on every page of the app.
      */}
      {variant === 'public' ? (
        <p className="w-full text-sm text-ink-soft">{WHAT_WE_DO_SHORT}</p>
      ) : null}
    </header>
  )
}
