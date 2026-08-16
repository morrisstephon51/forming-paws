'use client'

import { useEffect } from 'react'
import { useShareLocation } from '@/lib/hooks/useShareLocation'

export default function LocationSettings({ currentLabel }: { currentLabel: string | null }) {
  const { cityLabel, setCityLabel, error, isSaving, share } = useShareLocation()

  // The hook always starts cityLabel at '' since it has no knowledge of
  // this page's current-location prop. Seed it here so the input still
  // pre-fills with the owner's saved city, matching the prior behavior.
  useEffect(() => {
    setCityLabel(currentLabel ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mt-4 rounded border p-4">
      <p className="text-sm font-medium">Location</p>
      <p className="text-sm text-gray-600">
        {currentLabel ? `Currently set to ${currentLabel}.` : 'Not set — browse still works without it.'}
      </p>
      <div className="mt-2 flex gap-2">
        <input
          value={cityLabel}
          onChange={(e) => setCityLabel(e.target.value)}
          placeholder="Your city"
          className="border p-2 text-sm flex-1"
        />
        <button
          onClick={share}
          disabled={isSaving}
          className="bg-brand text-white px-3 py-1 rounded text-sm"
        >
          {isSaving ? 'Saving…' : 'Share location'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
