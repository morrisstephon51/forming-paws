'use client'

import { useShareLocation } from '@/lib/hooks/useShareLocation'

export default function LocationPrompt() {
  const { cityLabel, setCityLabel, error, isSaving, share } = useShareLocation()

  return (
    <div className="mt-4 rounded border p-4">
      <p className="text-sm text-ink-soft">
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
