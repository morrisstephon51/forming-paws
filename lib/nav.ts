export type NavVariant = 'public' | 'member'

export type NavLink = { href: string; label: string; icon?: string }

const PUBLIC_LINKS: NavLink[] = [
  { href: '/#how', label: 'How It Works' },
  { href: '/#health', label: 'Health First' },
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

/**
 * Top-of-funnel pages that carry the mobile "Join free" bar for signed-out
 * visitors.
 *
 * Deliberately excludes /login and /signup — someone already converting does
 * not need to be told to convert — and the legal pages, where a marketing bar
 * over the terms is both tacky and slightly suspect.
 */
const JOIN_BAR_ROUTES = new Set([
  '/',
  '/about',
  '/app',
  '/contact',
  '/donate',
  '/education',
  '/faq',
  '/vets',
])

/**
 * Whether the signed-out join bar belongs on this page.
 *
 * Paired with the member tab bar through a single either/or in AppChrome, so
 * the two fixed bottom bars can never stack. They did: /faq, /contact and /app
 * rendered the join bar unconditionally, so once the member tab bar existed a
 * signed-in member on those pages got both, one on top of the other.
 */
export function showsJoinBar(pathname: string): boolean {
  if (JOIN_BAR_ROUTES.has(pathname)) return true
  // Guides are top-of-funnel too, and there are three of them and counting.
  return pathname.startsWith('/education/')
}
