'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateMyLocation } from '@/lib/actions/location'

export default function LocationPrompt() {
  const router = useRouter()
  const [cityLabel, setCityLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function handleShare() {
    setError(null)
    if (!cityLabel.trim()) {
      setError('Enter your city first')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsSaving(true)
        updateMyLocation(position.coords.latitude, position.coords.longitude, cityLabel.trim())
          .then(() => router.refresh())
          .catch((err) => setError(err instanceof Error ? err.message : 'Failed to save location'))
          .finally(() => setIsSaving(false))
      },
      () => setError('Location permission denied — you can still browse without distance sorting')
    )
  }

  return (
    <div className="mt-4 rounded border p-4">
      <p className="text-sm text-gray-600">
        Share your location to sort by distance. Declining just skips distance sorting — browsing still works.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          value={cityLabel}
          onChange={(e) => setCityLabel(e.target.value)}
          placeholder="Your city"
          className="border p-2 text-sm flex-1"
        />
        <button
          onClick={handleShare}
          disabled={isSaving}
          className="bg-gray-900 text-white px-3 py-1 rounded text-sm"
        >
          {isSaving ? 'Saving…' : 'Share location'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
