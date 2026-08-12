import { describe, it, expect } from 'vitest'
import { newPasswordError, MIN_PASSWORD_LENGTH } from '@/lib/auth/password'
import { signupSchema } from '@/app/(auth)/signup/schema'

describe('newPasswordError', () => {
  it('accepts a long enough password that matches its confirmation', () => {
    expect(newPasswordError('goodenough', 'goodenough')).toBeNull()
  })

  it('rejects a password under the minimum length', () => {
    expect(newPasswordError('short', 'short')).toMatch(/at least 8/)
  })

  it('rejects a mistyped confirmation', () => {
    // A typo here would lock someone out of the account they are recovering.
    expect(newPasswordError('goodenough', 'goodenougg')).toMatch(/do not match/i)
  })

  it('reports the length problem first when both are wrong', () => {
    expect(newPasswordError('abc', 'xyz')).toMatch(/at least 8/)
  })

  it('holds resets to the same strength as sign-up', () => {
    const oneShort = 'a'.repeat(MIN_PASSWORD_LENGTH - 1)
    expect(newPasswordError(oneShort, oneShort)).not.toBeNull()
    expect(
      signupSchema.safeParse({
        email: 'a@b.com',
        password: oneShort,
        displayName: 'A',
        isAdult: true,
      }).success
    ).toBe(false)
  })
})
