export type NavVariant = 'public' | 'member'

export type NavLink = { href: string; label: string; icon?: string }

const PUBLIC_LINKS: NavLink[] = [
  { href: '#how', label: 'How It Works' },
  { href: '#health', label: 'Health First' },
  { href: '/education', label: 'Learn' },
  { href: '/about', label: 'About' },
]

const MEMBER_LINKS: NavLink[] = [
  { href: '/home', label: 'Home' },
  { href: '/browse', label: 'Browse' },
  { href: '/matches', label: 'Matches' },
  { href: '/education', label: 'Learn' },
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

/**
 * The member home. Every page's home button points here, and it is deliberately
 * a single exported constant rather than a '/home' string in fifteen files —
 * the last rename of this route (from /dashboard) had to touch every one of
 * them.
 */
export const MEMBER_HOME = '/home'

/**
 * Destinations for the bottom bar's rotating carousel.
 *
 * Home is NOT in this list, and that is the point: Stefan asked for a home
 * button on every page *and* for the bottom buttons to rotate. A rotating home
 * button rotates away. So the bar pins Home on the left and cycles these
 * beside it, which satisfies both requirements literally.
 */
export const CAROUSEL_LINKS: NavLink[] = [
  { href: '/browse', label: 'Browse', icon: '🔍' },
  { href: '/matches', label: 'Matches', icon: '💬' },
  { href: '/dogs/new', label: 'Add a dog', icon: '🐕' },
  { href: '/education', label: 'Learn', icon: '📚' },
  { href: '/vets', label: 'Vets', icon: '🩺' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

/**
 * Which carousel slide to show first.
 *
 * Starting on the slide matching the current page would highlight a link to
 * where the member already is. Starting on the *next* one puts a destination
 * they can actually use under their thumb.
 */
export function initialCarouselIndex(pathname: string): number {
  const here = CAROUSEL_LINKS.findIndex((link) => isActive(link.href, pathname))
  if (here === -1) return 0
  return (here + 1) % CAROUSEL_LINKS.length
}

/** Wraps in both directions, so `step(0, -1)` lands on the last slide. */
export function step(index: number, delta: number, length = CAROUSEL_LINKS.length): number {
  return (((index + delta) % length) + length) % length
}
