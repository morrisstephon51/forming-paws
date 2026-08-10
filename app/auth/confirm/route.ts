import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getRequestOrigin, loginUrlWithError, safeRedirectPath } from '@/lib/auth/redirects'

/**
 * Landing point for every emailed auth link (signup confirmation, magic link,
 * password recovery, email change).
 *
 * This uses `verifyOtp` with the token hash rather than `exchangeCodeForSession`
 * because the token hash is self-contained: it works when the link is opened in
 * a different browser or on a different device than the one that signed up,
 * which is what most people actually do when they check their email.
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = getRequestOrigin(request)

  // Supabase appends these when it rejects the link before ever reaching us.
  const linkError = searchParams.get('error_description') ?? searchParams.get('error')
  if (linkError) {
    return NextResponse.redirect(
      loginUrlWithError(origin, 'That confirmation link is no longer valid.', true)
    )
  }

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = safeRedirectPath(searchParams.get('next'))

  if (!tokenHash || !isEmailOtpType(type)) {
    return NextResponse.redirect(
      loginUrlWithError(origin, 'That confirmation link is incomplete.', true)
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    // The common case by far: the link was already used (often by the mail
    // provider's own link scanner) or it aged past the OTP expiry window.
    return NextResponse.redirect(
      loginUrlWithError(
        origin,
        'This confirmation link has already been used or has expired. Enter your email below and we will send you a fresh one.',
        true
      )
    )
  }

  return NextResponse.redirect(`${origin}${next}`)
}
