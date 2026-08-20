import { describe, it, expect } from 'vitest'
import { redirectToPath } from '@/lib/http'

function req(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { method: 'POST', headers })
}

describe('redirectToPath', () => {
  it('303-redirects a POST form to a GET', () => {
    const res = redirectToPath(req('http://localhost:3000/api/upload/photo'), '/dogs/abc')
    expect(res.status).toBe(303)
  })

  it('uses the request origin when there is no proxy header', () => {
    const res = redirectToPath(req('http://localhost:3000/api/upload/photo'), '/dogs/abc')
    expect(res.headers.get('location')).toBe('http://localhost:3000/dogs/abc')
  })

  it('sends the member back to the public domain, not the internal Vercel host', () => {
    // Behind Vercel, request.url carries the internal deployment host while the
    // address bar shows the custom domain. The redirect must follow the address
    // bar, or a member who just uploaded a photo is bounced off the site.
    const res = redirectToPath(
      req('https://formingpaws-git-main-xyz.vercel.app/api/upload/photo', {
        'x-forwarded-host': 'formingpaws.com',
        'x-forwarded-proto': 'https',
      }),
      '/dogs/abc'
    )
    expect(res.headers.get('location')).toBe('https://formingpaws.com/dogs/abc')
  })

  it('regression: the old new URL(path, request.url) pattern leaked the internal host', () => {
    // Documents exactly what this helper replaces: building the redirect from
    // request.url ignores x-forwarded-host and points at the deployment host.
    const request = req('https://formingpaws-git-main-xyz.vercel.app/api/upload/photo', {
      'x-forwarded-host': 'formingpaws.com',
    })
    const leaked = new URL('/dogs/abc', request.url).toString()
    expect(leaked).toBe('https://formingpaws-git-main-xyz.vercel.app/dogs/abc')

    const fixed = redirectToPath(request, '/dogs/abc').headers.get('location')
    expect(fixed).toBe('https://formingpaws.com/dogs/abc')
  })
})
