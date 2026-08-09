import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getRequestOrigin, loginUrlWithError, safeRedirectPath } from '@/lib/auth/redirects'

/**
 * PKCE callback, used by OAuth sign-in (Google) and by any emailed link that
 * still carries a `?code=`. Emailed links issued from the current templates go
 * to /auth/confirm instead.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = getRequestOrigin(request)
  const next = safeRedirectPath(searchParams.get('next'))

  const providerError = searchParams.get('error_description') ?? searchParams.get('error')
  if (providerError) {
    return NextResponse.redirect(loginUrlWithError(origin, providerError))
  }

  const code = searchParams.get('code')

  if (!code) {
    // Previously this fell through to /dashboard, which bounced the user back to
    // /login with no explanation. Anything landing here without a code either
    // already has a session or never will.
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    if (data.user) return NextResponse.redirect(`${origin}${next}`)

    return NextResponse.redirect(
      loginUrlWithError(origin, 'We could not complete that sign-in. Please try again.', true)
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(loginUrlWithError(origin, error.message, true))
  }

  return NextResponse.redirect(`${origin}${next}`)
}
