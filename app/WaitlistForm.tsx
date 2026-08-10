'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Carried over from the static marketing page's waitlist band.
 *
 * The insert policy on `waitlist` grants only the `anon` role, so this is shown
 * to signed-out visitors only — a signed-in member is `authenticated` and the
 * insert would be refused.
 */
export default function WaitlistForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'joined' | 'already'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setState('sending')
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('waitlist').insert({
      email: String(formData.get('email')).trim(),
      city: String(formData.get('city') ?? '').trim() || null,
      dog_breed: String(formData.get('dogBreed') ?? '').trim() || null,
    })

    if (insertError) {
      // 23505 is a unique violation — they are already signed up, which is
      // good news rather than an error worth showing as one.
      if (insertError.code === '23505') {
        setState('already')
        return
      }
      setError('Something went wrong — please try again in a minute.')
      setState('idle')
      return
    }

    setState('joined')
  }

  if (state === 'joined') {
    return (
      <p className="mt-6 font-medium text-green-700">
        🎉 You&apos;re on the list. We&apos;ll email you when we launch in your area.
      </p>
    )
  }

  if (state === 'already') {
    return (
      <p className="mt-6 font-medium text-green-700">
        You&apos;re already on the waitlist — see you at launch! 🐾
      </p>
    )
  }

  return (
    <form action={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <input
        name="email"
        type="email"
        required
        placeholder="Your email"
        aria-label="Your email"
        className="min-w-0 flex-1 rounded border p-2"
      />
      <input
        name="city"
        type="text"
        placeholder="Your city"
        aria-label="Your city"
        className="min-w-0 flex-1 rounded border p-2"
      />
      <input
        name="dogBreed"
        type="text"
        placeholder="Your dog's breed (optional)"
        aria-label="Your dog's breed"
        className="min-w-0 flex-1 rounded border p-2"
      />
      <button
        type="submit"
        disabled={state === 'sending'}
        className="rounded bg-gray-900 px-5 py-2 text-white disabled:opacity-50"
      >
        {state === 'sending' ? 'Joining…' : 'Join the Waitlist'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  )
}
