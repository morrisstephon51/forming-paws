'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateMyLocation } from '@/lib/actions/location'

export function useShareLocation() {
  const router = useRouter()
  const [cityLabel, setCityLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function share() {
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
      () => setError('Location permission denied — distance sorting will be unavailable')
    )
  }

  return { cityLabel, setCityLabel, error, isSaving, share }
}
