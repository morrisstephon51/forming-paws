import { describe, it, expect } from 'vitest'
import { dogListLabel } from '@/app/dashboard/dogLabel'

describe('dogListLabel', () => {
  it('marks a verified dog', () => {
    expect(dogListLabel('Luna', 'female', true)).toBe('Luna — female · ✓ Health verified')
  })

  it('marks an unverified dog as pending', () => {
    expect(dogListLabel('Duke', 'male', false)).toBe('Duke — male · Verification pending')
  })
})
