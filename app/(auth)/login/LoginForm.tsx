'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
  const [showResend, setShowResend] = useState(offerResend)
  const [resendEmail, setResendEmail] = useState(initialEmail ?? '')
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [resendError, setResendError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)

    const supabase = createClient()
    const email = String(formData.get('email'))
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: String(formData.get('password')),
    })

    if (signInError) {
      setError(signInError.message)
      // Supabase reports an unconfirmed account this way. Surfacing the resend
      // path here is the difference between a dead end and a recoverable one.
      if (/email not confirmed/i.test(signInError.message)) {
        setResendEmail(email)
        setShowResend(true)
      }
      return
    }

    router.push('/dashboard')
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
      setResendError(resendErr.message)
      setResendState('idle')
      return
    }

    setResendState('sent')
  }

  async function handleGoogleLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="w-full">
      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          defaultValue={initialEmail}
          className="border p-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="border p-2"
        />
        <button type="submit" className="bg-gray-900 text-white p-2 rounded">
          Log in
        </button>
      </form>

      <button onClick={handleGoogleLogin} className="mt-4 border p-2 rounded w-full">
        Continue with Google
      </button>

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
                  className="border p-2 flex-1"
                />
                <button
                  onClick={handleResend}
                  disabled={!resendEmail || resendState === 'sending'}
                  className="border px-3 rounded disabled:opacity-50"
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
