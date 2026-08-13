import { describe, it, expect } from 'vitest'
import { humanAuthError } from '@/lib/auth/errors'

describe('humanAuthError', () => {
  it('passes a useful message straight through', () => {
    expect(humanAuthError('Invalid login credentials')).toBe('Invalid login credentials')
  })

  it('replaces the empty object Supabase returns on a 500', () => {
    // Observed live: with SMTP misconfigured, sign-up rendered the literal
    // string "{}" at someone trying to join.
    expect(humanAuthError('{}')).toMatch(/on our side/i)
    expect(humanAuthError('')).toMatch(/on our side/i)
    expect(humanAuthError(null)).toMatch(/on our side/i)
    expect(humanAuthError('[object Object]')).toMatch(/on our side/i)
  })

  it('says nothing was created when the email could not be sent', () => {
    // The signup is rolled back, so telling them to "check their email" would
    // send them looking for a message that will never arrive.
    const message = humanAuthError('Error sending confirmation email')
    expect(message).toMatch(/nothing was created/i)
    expect(message).toMatch(/try again/i)
  })

  it('explains the hourly email cap rather than repeating it', () => {
    expect(humanAuthError('email rate limit exceeded')).toMatch(/limit for the hour/i)
  })
})
