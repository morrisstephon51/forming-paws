import { describe, it, expect } from 'vitest'
import { signupSchema } from '@/app/(auth)/signup/schema'

describe('signupSchema', () => {
  it('rejects signup without the 18+ attestation', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test Owner',
      isAdult: false,
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid signup with the attestation checked', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test Owner',
      isAdult: true,
    })
    expect(result.success).toBe(true)
  })
})
