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
 * The trailing-slash check is what stops /match from matching /matches.
 */
export function isActive(href: string, pathname: string): boolean {
  if (href.startsWith('#')) return false
  if (pathname === href) return true
  return pathname.startsWith(`${href}/`)
}
