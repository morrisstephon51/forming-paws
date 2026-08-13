'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Carried over from the static marketing page's waitlist band.
 *
 * The insert policy on `waitlist` grants only the `anon` role, so this is shown
 * to signed-out visitors only — a signed-in member is `authenticated` and the
 * insert would be refused.
 */
export default function WaitlistForm() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'sending' | 'already'>('idle')
  const [error, setError] = useState<string | null>(null)
  // Controlled, for the same reason as every other form here: React clears a
  // form once its action has run, so a failed insert would wipe the address they
  // just typed and ask them to do it again.
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [dogBreed, setDogBreed] = useState('')

  async function handleSubmit() {
    setState('sending')
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('waitlist').insert({
      email: email.trim(),
      city: city.trim() || null,
      dog_breed: dogBreed.trim() || null,
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

    router.push('/thank-you?from=waitlist')
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
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        required
        placeholder="Your email"
        aria-label="Your email"
        className="min-w-0 flex-1 rounded border p-2"
      />
      <input
        name="city"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        type="text"
        placeholder="Your city"
        aria-label="Your city"
        className="min-w-0 flex-1 rounded border p-2"
      />
      <input
        name="dogBreed"
        value={dogBreed}
        onChange={(e) => setDogBreed(e.target.value)}
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
