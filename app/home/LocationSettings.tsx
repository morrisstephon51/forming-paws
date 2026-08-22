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
    <div className="fp-card mt-4">
      <p className="text-sm text-ink-soft">
        {currentLabel
          ? `Currently set to ${currentLabel}.`
          : 'Not set — browse still works without it, but we cannot show distances.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <label htmlFor="city-label" className="sr-only">
          Your city
        </label>
        <input
          id="city-label"
          value={cityLabel}
          onChange={(e) => setCityLabel(e.target.value)}
          placeholder="Your city"
          className="min-w-0 flex-1 rounded-lg border border-hairline border-hairline bg-wash p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        />
        <button onClick={share} disabled={isSaving} className="fp-btn px-4 py-2 text-sm">
          {isSaving ? 'Saving…' : 'Share location'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
