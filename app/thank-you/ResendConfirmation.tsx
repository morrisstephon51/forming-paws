'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { humanAuthError } from '@/lib/auth/errors'

/**
 * The way out when the confirmation email doesn't arrive — which, with a link
 * scanner burning one-time links and a mail provider that can rate-limit us, is
 * common enough that it needs to be one click and not a support ticket.
 */
export default function ResendConfirmation({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function resend() {
    setState('sending')
    setError(null)

    const supabase = createClient()
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    })

    if (resendError) {
      setError(humanAuthError(resendError.message))
      setState('idle')
      return
    }

    setState('sent')
  }

  if (state === 'sent') {
    return (
      <p className="mt-6 text-sm text-green-700">
        Sent again. If it still doesn&apos;t arrive, check your spam folder.
      </p>
    )
  }

  return (
    <div className="mt-6">
      <button
        onClick={resend}
        disabled={state === 'sending'}
        className="text-sm underline text-ink-soft disabled:opacity-50"
      >
        {state === 'sending' ? 'Sending…' : "Didn't arrive? Send it again"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
