import Link from 'next/link'

/**
 * A join button pinned to the bottom of the screen on phones only.
 *
 * On a phone the hero's call to action scrolls away within one swipe and never
 * comes back — most of the page is read with no way to act on it in view. On a
 * desktop the sign-in panel and header button stay reachable, so this would be
 * clutter; it is hidden from `sm:` up.
 *
 * Signed-in members never see it. `pb-safe` padding keeps it clear of the home
 * indicator on iPhones.
 */
export default function StickyJoinBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 p-3 backdrop-blur sm:hidden">
      <div
        className="flex items-center gap-3"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <p className="flex-1 text-xs leading-tight text-gray-600">
          Free to join · health-verified matches near you
        </p>
        <Link
          href="/signup"
          className="whitespace-nowrap rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Join free
        </Link>
      </div>
    </div>
  )
}
