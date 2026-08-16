import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Covers the redirect the health-document upload route issues after a successful
 * upload.
 *
 * The bug (issue #42, the twin of the photo-route fix in #41): the route ended
 * with `NextResponse.redirect(new URL(`/dogs/${dogId}`, request.url), 303)`.
 * Behind Vercel, `request.url` carries the internal deployment host, not the
 * address-bar domain, so a *successful* upload 303'd the member off to
 * `formingpaws-git-*.vercel.app` — which, on a protected preview, sits behind a
 * deployment-protection login wall, making a success look like a failure. The
 * fix routes the redirect through `getRequestOrigin(request)`, the same helper
 * the emailed-auth-link flow already uses (`lib/auth/link.ts`).
 */

const getUser = vi.fn()
const single = vi.fn()
const upload = vi.fn()
const insert = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({ eq: () => ({ single }) }),
      insert,
    }),
    storage: { from: () => ({ upload }) },
  }),
}))

const { POST } = await import('@/app/api/upload/health-doc/route')

/** The internal deployment host Vercel puts in `request.url`. */
const INTERNAL_HOST = 'formingpaws-git-main-abc123.vercel.app'
/** The host the member actually typed, delivered via `x-forwarded-host`. */
const PUBLIC_HOST = 'formingpaws.com'

function uploadRequest({ forwardedHost }: { forwardedHost?: string } = {}): Request {
  const form = new Map<string, unknown>([
    ['dogId', 'dog-1'],
    ['docType', 'vet_exam'],
    ['documentDate', '2024-01-15'],
    ['file', { size: 1024, type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(8) }],
  ])
  const headers = new Headers()
  if (forwardedHost) headers.set('x-forwarded-host', forwardedHost)
  return {
    url: `https://${INTERNAL_HOST}/api/upload/health-doc`,
    headers,
    formData: async () => form,
  } as unknown as Request
}

function location(response: Response) {
  return response.headers.get('location') ?? ''
}

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } } })
  single.mockReset().mockResolvedValue({ data: { owner_id: 'user-1' } })
  upload.mockReset().mockResolvedValue({ error: null })
  insert.mockReset().mockResolvedValue({ error: null })
})

describe('POST /api/upload/health-doc redirect', () => {
  it('303s to the public forwarded host, not the internal deploy host', async () => {
    const response = await POST(uploadRequest({ forwardedHost: PUBLIC_HOST }))

    expect(response.status).toBe(303)
    expect(location(response)).toBe(`https://${PUBLIC_HOST}/dogs/dog-1`)
  })

  it('never leaks the internal Vercel host into the Location (regression guard for #42)', async () => {
    const response = await POST(uploadRequest({ forwardedHost: PUBLIC_HOST }))

    // The old `new URL(path, request.url)` would have produced INTERNAL_HOST here.
    expect(new URL(location(response)).host).toBe(PUBLIC_HOST)
    expect(location(response)).not.toContain(INTERNAL_HOST)
  })

  it('falls back to the request origin for local/no-proxy requests', async () => {
    const response = await POST(uploadRequest())

    // No x-forwarded-host: behaviour is unchanged from request.url — local dev still works.
    expect(location(response)).toBe(`https://${INTERNAL_HOST}/dogs/dog-1`)
  })
})
