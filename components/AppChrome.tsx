'use client'

import { usePathname } from 'next/navigation'
import SiteHeader from './SiteHeader'
import MemberTabBar from './MemberTabBar'
import StickyJoinBar from './StickyJoinBar'
import { showsJoinBar } from '@/lib/nav'

/**
 * The site-wide furniture: the header on every page, and the member tab bar
 * underneath it.
 *
 * This lives in the root layout rather than being pasted into each page,
 * because "every page has a home button" is only true if it is structurally
 * impossible for a page to forget one. Fifteen of twenty-one pages had no
 * header at all before this — including /dogs/[id], /matches/[id] and every
 * admin page — and each was a dead end you could only leave with the back
 * button.
 *
 * A thin client wrapper because the header needs `usePathname` to mark the
 * active route, and a server layout cannot read it. Everything else is decided
 * on the server and passed down.
 */
export default function AppChrome({
  signedIn,
  displayName,
  unreadCount,
}: {
  signedIn: boolean
  displayName: string | null
  unreadCount: number
}) {
  const pathname = usePathname() ?? '/'

  return (
    <>
      <div className="mx-auto max-w-5xl px-6">
        <SiteHeader
          variant={signedIn ? 'member' : 'public'}
          pathname={pathname}
          unreadCount={unreadCount}
          displayName={displayName}
        />
      </div>
      {/*
        One bottom bar, decided in one place. An either/or rather than two
        independent conditions, so the member tab bar and the join bar cannot
        both render — which is exactly what started happening on /faq, /contact
        and /app, where the join bar was hard-coded into the page.
      */}
      {signedIn ? <MemberTabBar /> : showsJoinBar(pathname) && <StickyJoinBar />}
    </>
  )
}
