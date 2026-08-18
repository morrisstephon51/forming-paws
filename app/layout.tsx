import type { Metadata } from 'next'
import './globals.css'
import HashSessionRecovery from './auth/HashSessionRecovery'
import AppChrome from '@/components/AppChrome'
import { createClient } from '@/lib/supabase/server'
import { threadSummaries, totalUnread } from '@/lib/chat/threads'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  // Makes every relative URL below resolve absolutely, which Open Graph requires.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Healthy Matches. Happy Litters.`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Healthy Matches. Happy Litters.`,
    description: SITE_DESCRIPTION,
    url: '/',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Healthy Matches. Happy Litters.`,
    description: SITE_DESCRIPTION,
  },
  icons: {
    icon: [
      {
        url: '/logo.svg',
        type: 'image/svg+xml',
      },
    ],
  },
}

/**
 * Reading the session here makes every route dynamic, which is a deliberate
 * trade. The alternative was a header on some pages and not others — which is
 * what we had, and it left fifteen pages with no way back to the member home.
 *
 * The session read also replaces the per-page unread lookups: /browse and
 * /matches each ran their own `match_thread_summaries` RPC to feed their own
 * header. Now it happens once, here.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  let displayName: string | null = null
  let unreadCount = 0
  let signedIn = false

  if (userData.user) {
    const { data: owner } = await supabase
      .from('owners')
      .select('display_name, deactivated_at')
      .eq('id', userData.user.id)
      .maybeSingle()

    // A member mid-deletion gets the public header and no tab bar.
    //
    // Not cosmetic: /home, /browse, /matches and /settings all redirect a
    // deactivated member to /account/reactivate, so member navigation would be
    // a row of buttons that bounce them straight back to the page they are on.
    // The rotating tab bar would do it once every five seconds.
    signedIn = !owner?.deactivated_at

    if (signedIn) {
      displayName = owner?.display_name ?? null
      unreadCount = totalUnread(await threadSummaries(supabase))
    }
  }

  return (
    <html lang="en">
      {/*
        Clearance for whichever fixed bottom bar AppChrome renders, so neither
        can sit on top of the last element of a page — most often a submit
        button. The member tab bar is taller (it carries a dot row), hence the
        two sizes. This used to be a per-page `pb-28` that only / remembered.

        `sm:pb-8` on the visitor case because the join bar is mobile-only.
      */}
      <body
        className={`min-h-screen bg-ivory font-body text-ink ${
          signedIn ? 'pb-36' : 'pb-28 sm:pb-8'
        }`}
      >
        <HashSessionRecovery />
        <AppChrome signedIn={signedIn} displayName={displayName} unreadCount={unreadCount} />
        {children}
      </body>
    </html>
  )
}
