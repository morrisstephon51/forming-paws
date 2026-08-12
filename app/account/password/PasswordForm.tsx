'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { newPasswordError } from '@/lib/auth/password'

export default function PasswordForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Controlled on purpose. React resets a form after its action runs, so with
  // plain inputs a mistyped confirmation empties both boxes — and someone who
  // retypes only the second one is then told their password is too short.
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  async function handleSubmit() {
    const problem = newPasswordError(password, confirmation)
    if (problem) {
      setError(problem)
      return
    }

    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form action={handleSubmit} className="mt-6 flex flex-col gap-4">
      <label htmlFor="password" className="text-sm font-medium">
        New password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2"
      />

      <label htmlFor="confirmation" className="text-sm font-medium">
        Type it again
      </label>
      <input
        id="confirmation"
        name="confirmation"
        type="password"
        required
        autoComplete="new-password"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        className="border p-2"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-gray-900 text-white p-2 rounded disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  )
}
