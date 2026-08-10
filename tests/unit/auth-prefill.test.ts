import { describe, it, expect } from 'vitest'
import { safeEmailParam } from '@/lib/auth/prefill'

describe('safeEmailParam', () => {
  it('returns undefined when nothing was supplied', () => {
    expect(safeEmailParam(null)).toBeUndefined()
    expect(safeEmailParam(undefined)).toBeUndefined()
    expect(safeEmailParam('')).toBeUndefined()
  })

  it('trims surrounding whitespace', () => {
    expect(safeEmailParam('  owner@example.com  ')).toBe('owner@example.com')
  })

  it('rejects a value that is not remotely an address', () => {
    expect(safeEmailParam('not-an-email')).toBeUndefined()
    expect(safeEmailParam('@')).toBeUndefined()
    expect(safeEmailParam('a@')).toBeUndefined()
    expect(safeEmailParam('@b.com')).toBeUndefined()
  })

  it('rejects interior control characters, so a crafted link cannot inject line breaks', () => {
    expect(safeEmailParam('owner@example.com\nBcc: attacker@evil.com')).toBeUndefined()
    expect(safeEmailParam('own\ter@example.com')).toBeUndefined()
  })

  it('trims trailing line breaks rather than rejecting the address', () => {
    // Once trimmed there is nothing left to inject, so this is a valid address.
    expect(safeEmailParam('owner@example.com\r\n')).toBe('owner@example.com')
  })

  it('rejects anything longer than the RFC 5321 maximum', () => {
    const tooLong = 'a'.repeat(250) + '@example.com'
    expect(safeEmailParam(tooLong)).toBeUndefined()
  })

  it('accepts an ordinary address', () => {
    expect(safeEmailParam('owner@example.com')).toBe('owner@example.com')
  })
})
