import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getRequestOrigin, loginUrlWithError, safeRedirectPath } from '@/lib/auth/redirects'

/**
 * The single landing point for every link that is supposed to produce a session:
 * emailed signup confirmations, magic links, password recovery, email change,
 * and OAuth returns.
 *
 * It accepts both shapes a Supabase link can arrive in, because which one you
 * get is decided by an email template in the Supabase dashboard, not by this
 * codebase:
 *
 *   ?token_hash=…&type=…  the template calls {{ .TokenHash }}. Self-contained,
 *                         so it works even when the member opens the mail on a
 *                         different device than they signed up on. Preferred.
 *
 *   ?code=…               the stock {{ .ConfirmationURL }} template. The click
 *                         goes to Supabase's /auth/v1/verify, which confirms the
 *                         account and 303s back here with a PKCE code. The code
 *                         is only redeemable in the browser holding the matching
 *                         verifier cookie.
 *
 * Handling only one of the two is how a confirmed member ended up staring at
 * "That confirmation link is incomplete." on the login page.
 */

const VALID_TYPES = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && VALID_TYPES.has(value as EmailOtpType)
}

/** The link was valid once. Re-sending is the way out. */
const SPENT_LINK =
  'This confirmation link has already been used or has expired. Enter your email below and we will send you a fresh one.'

/**
 * A PKCE code can only be redeemed by the browser that started the sign-up,
 * because the matching verifier lives in that browser's cookies. Opening the
 * mail in a webmail app's in-app browser is enough to break it, so say so
 * plainly instead of blaming the link.
 */
const WRONG_BROWSER =
  'We could not confirm you from here. This link was opened in a different browser than the one you signed up in, or it has expired. Enter your email below and we will send you a fresh link.'

const NOTHING_USABLE = 'That confirmation link is incomplete.'

export async function handleAuthLink(
  request: Request,
  { offerResendOnLinkError = true }: { offerResendOnLinkError?: boolean } = {}
): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const origin = getRequestOrigin(request)
  const next = safeRedirectPath(searchParams.get('next'))
  const done = () => NextResponse.redirect(`${origin}${next}`)
  const failed = (message: string, canResend = true) =>
    NextResponse.redirect(loginUrlWithError(origin, message, canResend))

  // Supabase appends these when it rejects the link before it ever reaches us,
  // and OAuth providers append them when sign-in is refused.
  const linkError = searchParams.get('error_description') ?? searchParams.get('error')
  if (linkError) {
    return offerResendOnLinkError
      ? failed('That confirmation link is no longer valid.')
      : failed(linkError, false)
  }

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const code = searchParams.get('code')

  const supabase = await createClient()

  /**
   * Supabase throws — rather than returning an error — on transport failures and
   * on a missing PKCE verifier. An unhandled throw here renders a 500, which is
   * a dead end on the one page a new member has to get through, so every failure
   * becomes a redirect they can act on.
   */
  const succeeded = async (call: () => Promise<{ error: unknown }>) => {
    try {
      return !(await call()).error
    } catch {
      return false
    }
  }

  /**
   * A link works exactly once, and people click theirs twice. If consuming it
   * failed but this browser already holds a session, the member is in — send
   * them on instead of accusing a link that already did its job. A failed
   * exchange leaves an existing session intact, so this cannot mask a sign-out.
   */
  const failedUnlessSignedIn = async (message: string) => {
    try {
      const { data } = await supabase.auth.getUser()
      if (data.user) return done()
    } catch {
      // Fall through to the error below; it is the safe answer either way.
    }
    return failed(message)
  }

  if (tokenHash && isEmailOtpType(type)) {
    // By far the most common failure: the link was already used — often by the
    // mail provider's own link scanner — or it aged past the OTP expiry window.
    return (await succeeded(() => supabase.auth.verifyOtp({ type, token_hash: tokenHash })))
      ? done()
      : failedUnlessSignedIn(SPENT_LINK)
  }

  if (code) {
    return (await succeeded(() => supabase.auth.exchangeCodeForSession(code)))
      ? done()
      : failedUnlessSignedIn(WRONG_BROWSER)
  }

  return failedUnlessSignedIn(NOTHING_USABLE)
}
