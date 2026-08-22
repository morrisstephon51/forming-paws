import Link from 'next/link'
import Logo from './Logo'
import { navLinks, isActive, type NavVariant } from '@/lib/nav'

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
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4">
      <Link href={variant === 'member' ? '/home' : '/'} className="shrink-0">
        <Logo size="md" withWordmark />
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
    </header>
  )
}
