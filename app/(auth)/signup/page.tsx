'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signupSchema } from './schema'

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

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
    const { error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { display_name: parsed.data.displayName } },
    })

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    router.push('/dashboard')
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
