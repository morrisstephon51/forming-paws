'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { humanAuthError } from '@/lib/auth/errors'
import { signupSchema } from './schema'

export default function SignupForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  // Controlled on purpose. React resets a form once its action has run, so with
  // plain inputs one un-ticked age box wipes the name, email and password a new
  // member just typed — and makes them start the whole thing again.
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isAdult, setIsAdult] = useState(false)

  async function handleSubmit() {
    const parsed = signupSchema.safeParse({ email, password, displayName, isAdult })

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
      setError(humanAuthError(signUpError.message))
      return
    }

    if (!data.session) {
      // A real page rather than a state swap: it survives a refresh, it can be
      // linked to, and it is the only one of these three moments that can be
      // measured as a conversion.
      router.push(`/thank-you?from=signup&email=${encodeURIComponent(parsed.data.email)}`)
      return
    }

    router.push('/home')
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="fp-h2">Create your account</h1>
      <form action={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label htmlFor="signup-displayName" className="sr-only">
          Your name
        </label>
        <input
          id="signup-displayName"
          name="displayName"
          placeholder="Your name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="border p-2"
        />
        <label htmlFor="signup-email" className="sr-only">
          Email
        </label>
        <input
          id="signup-email"
          name="email"
          type="email"
          placeholder="Email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2"
        />
        <label htmlFor="signup-password" className="sr-only">
          Password
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          placeholder="Password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            name="isAdult"
            type="checkbox"
            checked={isAdult}
            onChange={(e) => setIsAdult(e.target.checked)}
          />
          I confirm I am 18 years of age or older
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="bg-brand text-white p-2 rounded">
          Sign up
        </button>
      </form>
    </main>
  )
}
