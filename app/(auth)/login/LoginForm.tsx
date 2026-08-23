'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { humanAuthError } from '@/lib/auth/errors'

/**
 * Renders the sign-in controls only — no page chrome. Both /login and the
 * landing page mount this, so each supplies its own heading and layout rather
 * than the form dictating one. Keeping it single-sourced is the point: this is
 * the only place in the app that handles credentials.
 */
export default function LoginForm({
  error: initialError,
  offerResend,
  initialEmail,
}: {
  error: string | null
  offerResend: boolean
  initialEmail?: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(initialError)
  // Controlled on purpose. React resets a form after its action runs, so plain
  // inputs would make a wrong password also erase the email address — twice the
  // typing for the mistake people actually make.
  const [email, setEmail] = useState(initialEmail ?? '')
  const [password, setPassword] = useState('')
  const [showResend, setShowResend] = useState(offerResend)
  const [resendEmail, setResendEmail] = useState(initialEmail ?? '')
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [resendError, setResendError] = useState<string | null>(null)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState(initialEmail ?? '')
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [resetError, setResetError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError(humanAuthError(signInError.message))
      // A wrong password is the other way a real member gets stranded, so the
      // way out is offered right where they hit the wall.
      if (/invalid login credentials/i.test(signInError.message)) {
        setResetEmail(email)
        setShowReset(true)
      }
      // Supabase reports an unconfirmed account this way. Surfacing the resend
      // path here is the difference between a dead end and a recoverable one.
      if (/email not confirmed/i.test(signInError.message)) {
        setResendEmail(email)
        setShowResend(true)
      }
      return
    }

    router.push('/home')
    router.refresh()
  }

  async function handleResend() {
    setResendState('sending')
    setResendError(null)

    const supabase = createClient()
    const { error: resendErr } = await supabase.auth.resend({
      type: 'signup',
      email: resendEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    })

    if (resendErr) {
      setResendError(humanAuthError(resendErr.message))
      setResendState('idle')
      return
    }

    setResendState('sent')
  }

  async function handleReset() {
    setResetState('sending')
    setResetError(null)

    const supabase = createClient()
    // `next` rides along on the link so /auth/confirm — which is what actually
    // consumes the recovery token and creates the session — knows to forward
    // them to the page where they choose the new password.
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/account/password`,
    })

    if (resetErr) {
      setResetError(humanAuthError(resetErr.message))
      setResetState('idle')
      return
    }

    setResetState('sent')
  }

  async function handleGoogleLogin() {
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })

    // Without this the button is a dead control: when the provider is switched
    // off in Supabase the call fails silently and nothing at all happens on the
    // page, which reads as a broken site rather than an unavailable option.
    if (oauthError) {
      setError('Google sign-in is unavailable right now. Use your email and password instead.')
    }
  }

  return (
    <div className="w-full">
      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label htmlFor="login-email" className="sr-only">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          placeholder="Email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-hairline p-2"
        />
        <label htmlFor="login-password" className="sr-only">
          Password
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          placeholder="Password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-hairline p-2"
        />
        <button type="submit" className="fp-btn">
          Log in
        </button>
      </form>

      {!showReset && (
        <button
          onClick={() => setShowReset(true)}
          className="mt-3 text-sm underline text-ink-soft"
        >
          Forgot your password?
        </button>
      )}

      {showReset && (
        <div className="mt-6 border-t pt-6">
          {resetState === 'sent' ? (
            <p className="text-sm text-green-700">
              If {resetEmail} has an account, a reset link is on its way. Open it and you can choose
              a new password.
            </p>
          ) : (
            <>
              <label htmlFor="reset-email" className="text-sm font-medium">
                Reset your password
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Your email"
                  className="border border-hairline p-2 flex-1"
                />
                <button
                  onClick={handleReset}
                  disabled={!resetEmail || resetState === 'sending'}
                  className="border border-hairline px-3 rounded disabled:opacity-50"
                >
                  {resetState === 'sending' ? 'Sending…' : 'Send link'}
                </button>
              </div>
              {resetError && <p className="mt-2 text-sm text-red-600">{resetError}</p>}
            </>
          )}
        </div>
      )}

      {/*
        Google is off in Supabase Auth, so this button only ever produced
        "provider is not enabled". Offering a sign-in route that cannot work
        costs members more than not offering it. Set
        NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true once the provider is configured.
      */}
      {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true' && (
        <button onClick={handleGoogleLogin} className="mt-4 border border-hairline p-2 rounded w-full">
          Continue with Google
        </button>
      )}

      {showResend && (
        <div className="mt-6 border-t pt-6">
          {resendState === 'sent' ? (
            <p className="text-sm text-green-700">
              New confirmation link sent to {resendEmail}. Check your inbox and spam folder.
            </p>
          ) : (
            <>
              <label htmlFor="resend-email" className="text-sm font-medium">
                Send a new confirmation link
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="resend-email"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="Your email"
                  className="border border-hairline p-2 flex-1"
                />
                <button
                  onClick={handleResend}
                  disabled={!resendEmail || resendState === 'sending'}
                  className="border border-hairline px-3 rounded disabled:opacity-50"
                >
                  {resendState === 'sending' ? 'Sending…' : 'Send'}
                </button>
              </div>
              {resendError && <p className="mt-2 text-sm text-red-600">{resendError}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
