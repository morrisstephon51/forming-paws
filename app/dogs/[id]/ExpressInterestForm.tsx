'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type MyDog = { id: string; name: string; isVerified: boolean }

export default function ExpressInterestForm({
  targetDogId,
  myDogs,
}: {
  targetDogId: string
  myDogs: MyDog[]
}) {
  const router = useRouter()
  const verifiedDogs = myDogs.filter((d) => d.isVerified)
  const [selectedDogId, setSelectedDogId] = useState(verifiedDogs[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (myDogs.length === 0) {
    return <p className="mt-4 text-sm text-ink-soft">Add a dog of your own to express interest.</p>
  }

  if (verifiedDogs.length === 0) {
    return (
      <p className="mt-4 text-sm text-ink-soft">
        Your dog needs verified health documents before it can express interest.{' '}
        <a href="/home" className="font-semibold text-brand underline">
          Upload them from your dashboard
        </a>
        . Verification is free for Founding Members.
      </p>
    )
  }

  if (success) {
    return <p className="mt-4 text-sm text-green-600">Interest expressed!</p>
  }

  async function handleSubmit() {
    setError(null)
    const supabase = createClient()
    const { error: insertError } = await supabase
      .from('dog_interests')
      .insert({ expressing_dog_id: selectedDogId, target_dog_id: targetDogId })

    if (insertError) {
      setError(
        insertError.code === '23505' ? 'Already expressed interest from this dog' : insertError.message
      )
      return
    }

    setSuccess(true)
    router.refresh()
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      <select
        value={selectedDogId}
        onChange={(e) => setSelectedDogId(e.target.value)}
        className="fp-input text-sm"
      >
        {verifiedDogs.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button onClick={handleSubmit} className="fp-btn px-4 py-1.5 text-sm">
        Express Interest
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
