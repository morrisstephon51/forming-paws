'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Sage from '@/components/mascot/Sage'

/**
 * The route-level error boundary. There wasn't one — an unhandled render error
 * anywhere in the app fell through to Next's default screen, which says
 * "Application error: a client-side exception has occurred" and offers a member
 * nothing to do next.
 *
 * `reset()` re-renders the segment, which genuinely fixes the transient cases
 * (a dropped fetch, an expired token refreshed on retry) without a full reload.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest is what ties this screen to the server log line for it.
    console.error('route error', error.digest ?? '', error)
  }, [error])

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <main className="flex flex-col items-center text-center">
        <Sage mood="confused" size={104} />
        <p className="mt-4 fp-eyebrow">Something went wrong</p>
        <h1 className="mt-3 fp-h1">That didn&apos;t load</h1>
        <p className="mt-4 text-ink-soft">
          The page hit an error on the way in. Nothing is wrong with your account, and nothing you
          saved has been lost.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="fp-btn">
            Try again
          </button>
          <Link href="/" className="fp-btn-ghost">
            Back to the home page
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-8 text-xs text-ink-soft">
            Reference <code>{error.digest}</code>. Quote this if you contact us.
          </p>
        ) : null}
      </main>
    </div>
  )
}
