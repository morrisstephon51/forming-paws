import { describe, it, expect } from 'vitest'
import { newLitterSchema, newPuppySchema, puppyInquirySchema } from '@/lib/validators/litter'

describe('newLitterSchema', () => {
  it('accepts a sire and dam with no dates', () => {
    const result = newLitterSchema.safeParse({
      sireId: '11111111-1111-1111-1111-111111111111',
      damId: '22222222-2222-2222-2222-222222222222',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-uuid dog id', () => {
    const result = newLitterSchema.safeParse({ sireId: 'not-a-uuid', damId: 'also-not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('newPuppySchema', () => {
  it('rejects a birth date in the future', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const result = newPuppySchema.safeParse({
      name: 'Biscuit',
      sex: 'female',
      birthDate: tomorrow,
    })
    expect(result.success).toBe(false)
  })

  it('accepts a puppy with no price', () => {
    const result = newPuppySchema.safeParse({
      name: 'Biscuit',
      sex: 'female',
      birthDate: '2026-06-01',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = newPuppySchema.safeParse({
      name: '  ',
      sex: 'female',
      birthDate: '2026-06-01',
    })
    expect(result.success).toBe(false)
  })
})

describe('puppyInquirySchema', () => {
  it('rejects an empty message', () => {
    expect(puppyInquirySchema.safeParse({ message: '' }).success).toBe(false)
  })

  it('rejects a message over 2000 characters', () => {
    expect(puppyInquirySchema.safeParse({ message: 'a'.repeat(2001) }).success).toBe(false)
  })

  it('accepts a real message', () => {
    expect(puppyInquirySchema.safeParse({ message: 'Is this puppy still available?' }).success).toBe(
      true
    )
  })
})
