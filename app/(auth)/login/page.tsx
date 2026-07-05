'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(formData.get('email')),
      password: String(formData.get('password')),
    })

    if (signInError) {
      setError(signInError.message)
      return
    }

    router.push('/dashboard')
  }

  async function handleGoogleLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form action={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input name="email" type="email" placeholder="Email" required className="border p-2" />
        <input name="password" type="password" placeholder="Password" required className="border p-2" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="bg-gray-900 text-white p-2 rounded">
          Log in
        </button>
      </form>
      <button onClick={handleGoogleLogin} className="mt-4 border p-2 rounded w-full">
        Continue with Google
      </button>
    </main>
  )
}
