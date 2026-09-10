import type { Metadata } from 'next'
import { Newsreader, Public_Sans } from 'next/font/google'
import './globals.css'
import HashSessionRecovery from './auth/HashSessionRecovery'
import AppChrome from '@/components/AppChrome'
import { createClient } from '@/lib/supabase/server'
import { threadSummaries, totalUnread } from '@/lib/chat/threads'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

/*
 * Both faces are self-hosted rather than pulled in by an @import at the top of
 * globals.css. That @import was a three-hop chain on the critical path — our
 * CSS, then Google's CSS, then the font files — with the whole page blocked
 * behind hop three. next/font inlines the @font-face rules, serves the files
 * from our own origin, and preloads them, which removes two round trips before
 * first paint.
 *
 * Both are requested as variable faces rather than as weight lists. The old
 * setup named its weights, and a note here used to record that Fraunces' optical
 * size axis was therefore inert — next/font drops every non-wght axis the moment
 * a `weight` is given. Newsreader's whole reason for being here is that axis, so
 * naming weights would throw away the thing it was chosen for.
 *
 * opsz is not a style knob. Newsreader ships genuinely different letterforms per
 * size: at 72 the hairlines thin and the spacing closes up for a headline, at 6
 * the stems thicken and open so the same face survives being small. Asking for
 * it means the display and the body get drawings actually made for their size
 * rather than one drawing scaled.
 */
const newsreader = Newsreader({
  subsets: ['latin'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-display',
})

const publicSans = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
})

export const metadata: Metadata = {
  // Makes every relative URL below resolve absolutely, which Open Graph requires.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: Healthy Matches. Happy Litters.`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME}: Healthy Matches. Happy Litters.`,
    description: SITE_DESCRIPTION,
    url: '/',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME}: Healthy Matches. Happy Litters.`,
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
    // suppressHydrationWarning because the gate script below deliberately adds
    // `sc-js` to this element before React hydrates, so the server and client
    // className necessarily differ. Scoped to <html> only: it suppresses the
    // warning for this element's own attributes, not for the tree beneath it.
    <html
      lang="en"
      className={`${newsreader.variable} ${publicSans.variable}`}
      suppressHydrationWarning
    >
      {/*
        The scroll-reveal safety gate.

        public/scrollcraft/scrollcraft.css sets `[data-sc-in] { opacity: 0 }`
        unconditionally and only restores it once the engine adds `.sc-in`.
        That put the whole front door one script failure away from a blank
        page, and it served 26 invisible text nodes to anything that does not
        run JavaScript — crawlers included.

        Two guards, because one is not enough:

        1. The class is added by script, so a visitor with no JavaScript never
           gets the hiding rule at all. It runs before first paint, so a normal
           visitor sees no flash of unrevealed content.
        2. If the engine has not mounted within 2.5s — bad network, a 404 on
           the asset, a throw inside the engine — the class is removed again
           and everything simply appears. Reveal animation is a nicety; the
           words are the product.

        A blocking inline script in <head>, not an effect and not next/script.
        An effect runs after paint, which is exactly when the flash would
        happen. next/script with `beforeInteractive` renders as a direct child
        of <html>, which is invalid nesting: React 19 refuses to hydrate it and
        the page threw four hydration errors on every frame ("<html> cannot
        contain a nested <script>"). An inline script in <head> runs at the same
        point and nests legally.
      */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.add('sc-js');setTimeout(function(){var s=window.ScrollCraft;if(!s||!s.instances||!s.instances.length){document.documentElement.classList.remove('sc-js')}},2500)",
          }}
        />
      </head>
      {/*
        Clearance for whichever fixed bottom bar AppChrome renders, so neither
        can sit on top of the last element of a page — most often a submit
        button. The member tab bar is taller (it carries a dot row), hence the
        two sizes. This used to be a per-page `pb-28` that only / remembered.

        `sm:pb-8` on the visitor case because the join bar is mobile-only.
      */}
      <body
        className={`fp-grain min-h-screen bg-ivory font-body text-ink ${
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
