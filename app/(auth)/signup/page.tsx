'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signupSchema } from './schema'

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [confirmationPending, setConfirmationPending] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [resendError, setResendError] = useState<string | null>(null)

  async function handleResend() {
    setResendState('sending')
    setResendError(null)

    const supabase = createClient()
    const { error: resendErr } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    })

    if (resendErr) {
      setResendError(resendErr.message)
      setResendState('failed')
      return
    }

    setResendState('sent')
  }

  async function handleSubmit(formData: FormData) {
    const parsed = signupSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
      displayName: formData.get('displayName'),
      isAdult: formData.get('isAdult') === 'on',
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: parsed.data.displayName },
        // Without this the confirmation link falls back to the Site URL set in
        // the Supabase dashboard, which is a single fixed value and cannot be
        // right for both localhost and production at once.
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (!data.session) {
      setPendingEmail(parsed.data.email)
      setConfirmationPending(true)
      return
    }

    router.push('/dashboard')
  }

  if (confirmationPending) {
    return (
      <main className="mx-auto max-w-sm p-8">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="mt-4 text-gray-600">
          We sent a confirmation link to <span className="font-medium">{pendingEmail}</span>. Open it
          on this device if you can — the link works once and expires after an hour.
        </p>
        <div className="mt-6">
          {resendState === 'sent' ? (
            <p className="text-sm text-green-700">
              Sent. If it still does not arrive, check your spam folder.
            </p>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendState === 'sending'}
              className="text-sm underline text-gray-600 disabled:opacity-50"
            >
              {resendState === 'sending' ? 'Sending…' : 'Resend confirmation email'}
            </button>
          )}
          {resendError && <p className="mt-2 text-sm text-red-600">{resendError}</p>}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <form action={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input name="displayName" placeholder="Your name" required className="border p-2" />
        <input name="email" type="email" placeholder="Email" required className="border p-2" />
        <input name="password" type="password" placeholder="Password" required className="border p-2" />
        <label className="flex items-center gap-2 text-sm">
          <input name="isAdult" type="checkbox" />
          I confirm I am 18 years of age or older
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="bg-gray-900 text-white p-2 rounded">
          Sign up
        </button>
      </form>
    </main>
  )
}
