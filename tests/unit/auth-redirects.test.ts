import { describe, it, expect } from 'vitest'
import {
  getRequestOrigin,
  safeRedirectPath,
  loginUrlWithError,
  postLoginPath,
  loginPathFor,
} from '@/lib/auth/redirects'

function req(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers })
}

describe('getRequestOrigin', () => {
  it('uses the request origin when there is no proxy header', () => {
    expect(getRequestOrigin(req('http://localhost:3000/auth/confirm'))).toBe('http://localhost:3000')
  })

  it('prefers the forwarded host so redirects point at the public domain', () => {
    const origin = getRequestOrigin(
      req('https://internal-host.vercel.app/auth/confirm', {
        'x-forwarded-host': 'formingpaws.com',
        'x-forwarded-proto': 'https',
      })
    )
    expect(origin).toBe('https://formingpaws.com')
  })

  it('defaults a forwarded host to https when no proto header is present', () => {
    const origin = getRequestOrigin(
      req('https://internal-host.vercel.app/auth/confirm', {
        'x-forwarded-host': 'formingpaws.com',
      })
    )
    expect(origin).toBe('https://formingpaws.com')
  })
})

describe('safeRedirectPath', () => {
  it('passes through a same-origin relative path', () => {
    expect(safeRedirectPath('/dogs/new')).toBe('/dogs/new')
  })

  it('falls back when next is absent', () => {
    expect(safeRedirectPath(null)).toBe('/home')
  })

  it('rejects an absolute URL to another site', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/home')
  })

  it('rejects a protocol-relative URL', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/home')
  })

  it('rejects a backslash-obfuscated protocol-relative URL', () => {
    expect(safeRedirectPath('/\\evil.com')).toBe('/home')
  })
})

describe('loginUrlWithError', () => {
  it('encodes the message into the query string', () => {
    const url = loginUrlWithError('https://formingpaws.com', 'Link expired & unusable')
    expect(url).toBe('https://formingpaws.com/login?error=Link+expired+%26+unusable')
  })

  it('adds the resend flag when the user can recover', () => {
    const url = loginUrlWithError('https://formingpaws.com', 'Expired', true)
    expect(url).toContain('resend=1')
  })
})

describe('postLoginPath', () => {
  it('returns the member to the page they asked for', () => {
    expect(postLoginPath('/admin/users')).toBe('/admin/users')
  })

  it('keeps the query string', () => {
    expect(postLoginPath('/browse?breed=3')).toBe('/browse?breed=3')
  })

  it('falls back to /home for anything that is not a same-origin path', () => {
    expect(postLoginPath('https://evil.com')).toBe('/home')
    expect(postLoginPath('//evil.com')).toBe('/home')
    expect(postLoginPath(undefined)).toBe('/home')
  })

  it('never sends a member back to the sign-in or sign-up form', () => {
    expect(postLoginPath('/login')).toBe('/home')
    expect(postLoginPath('/login?next=/admin')).toBe('/home')
    expect(postLoginPath('/signup')).toBe('/home')
  })

  it('does not mistake a longer path for the sign-in page', () => {
    expect(postLoginPath('/loginhelp')).toBe('/loginhelp')
  })
})

describe('loginPathFor', () => {
  it('carries the requested page as next', () => {
    expect(loginPathFor('/admin')).toBe('/login?next=%2Fadmin')
  })

  it('encodes a query string inside next', () => {
    expect(loginPathFor('/admin/users?q=a&b=c')).toBe('/login?next=%2Fadmin%2Fusers%3Fq%3Da%26b%3Dc')
  })

  it('is plain /login when there is nowhere better to return to', () => {
    expect(loginPathFor(null)).toBe('/login')
    expect(loginPathFor('/home')).toBe('/login')
    expect(loginPathFor('//evil.com')).toBe('/login')
  })
})
