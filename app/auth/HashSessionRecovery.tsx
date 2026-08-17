'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Rescues confirmation emails sent under the old implicit-flow template.
 *
 * Those links land on the site with the session in the URL *fragment*
 * (`#access_token=...&refresh_token=...`). A fragment is never sent to the
 * server, so no route handler can see it — it has to be picked up in the
 * browser. Without this, every confirmation email already sitting in an inbox
 * drops the user on a page with no session and no explanation.
 *
 * Newly-sent links go to /auth/confirm and never hit this path. This can be
 * removed once no pre-fix emails are still in circulation.
 */
export default function HashSessionRecovery() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash.length < 2) return

    const params = new URLSearchParams(hash.slice(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const errorDescription = params.get('error_description')

    function clearHash() {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }

    if (errorDescription) {
      clearHash()
      router.replace(`/login?error=${encodeURIComponent(errorDescription)}&resend=1`)
      return
    }

    if (!accessToken || !refreshToken) return

    let cancelled = false
    const supabase = createClient()

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (cancelled) return
        clearHash()
        if (error) {
          router.replace(
            `/login?error=${encodeURIComponent(
              'This confirmation link has already been used or has expired.'
            )}&resend=1`
          )
          return
        }
        router.replace('/home')
        router.refresh()
      })

    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
