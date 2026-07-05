import { describe, it, expect } from 'vitest'
import { dogSchema } from '@/app/dogs/new/NewDogForm'

describe('dogSchema', () => {
  it('rejects a birth date in the future', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const result = dogSchema.safeParse({
      name: 'Rex',
      breedId: '1',
      sex: 'male',
      birthDate: tomorrow,
      weightLbs: '',
      temperamentNotes: '',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid dog profile', () => {
    const result = dogSchema.safeParse({
      name: 'Rex',
      breedId: '1',
      sex: 'male',
      birthDate: '2023-01-15',
      weightLbs: '65',
      temperamentNotes: 'Friendly, high energy',
    })
    expect(result.success).toBe(true)
  })
})
