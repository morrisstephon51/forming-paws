import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * These cover the two route handlers every emailed and OAuth auth link lands on.
 *
 * The bug that prompted them: a real member's confirmation link arrived as
 * `/auth/confirm?code=…` (Supabase's stock `{{ .ConfirmationURL }}` template
 * routes the click through `/auth/v1/verify`, which 303s to the app with a PKCE
 * code, not a token hash). The route only understood `token_hash`, so it sent a
 * confirmed member to /login with "That confirmation link is incomplete."
 */

const verifyOtp = vi.fn()
const exchangeCodeForSession = vi.fn()
const getUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { verifyOtp, exchangeCodeForSession, getUser } }),
}))

const { GET: confirm } = await import('@/app/auth/confirm/route')
const { GET: callback } = await import('@/app/auth/callback/route')

const ORIGIN = 'https://theplugai.xyz'

function link(path: string) {
  return new Request(`${ORIGIN}${path}`)
}

/** The Location a route handler redirected to. */
function location(response: Response) {
  return response.headers.get('location') ?? ''
}

function errorMessage(response: Response) {
  return new URL(location(response)).searchParams.get('error') ?? ''
}

beforeEach(() => {
  verifyOtp.mockReset().mockResolvedValue({ error: null })
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null })
  getUser.mockReset().mockResolvedValue({ data: { user: null } })
})

describe('/auth/confirm', () => {
  it('confirms a token-hash link and lands the member on the dashboard', async () => {
    const response = await confirm(link('/auth/confirm?token_hash=abc123&type=signup'))

    expect(verifyOtp).toHaveBeenCalledWith({ type: 'signup', token_hash: 'abc123' })
    expect(location(response)).toBe(`${ORIGIN}/dashboard`)
  })

  it('confirms a PKCE code link, which is what the stock email template sends', async () => {
    const response = await confirm(link('/auth/confirm?code=68cb7ad6-e563-40af-be69-1352574efa4b'))

    expect(exchangeCodeForSession).toHaveBeenCalledWith('68cb7ad6-e563-40af-be69-1352574efa4b')
    expect(location(response)).toBe(`${ORIGIN}/dashboard`)
  })

  it('prefers the token hash when a link somehow carries both', async () => {
    await confirm(link('/auth/confirm?token_hash=abc123&type=signup&code=xyz'))

    expect(verifyOtp).toHaveBeenCalled()
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('honours a safe next destination', async () => {
    const response = await confirm(link('/auth/confirm?code=abc&next=%2Fdogs%2Fnew'))

    expect(location(response)).toBe(`${ORIGIN}/dogs/new`)
  })

  it('refuses to bounce a fresh session off to another site', async () => {
    const response = await confirm(link('/auth/confirm?code=abc&next=https%3A%2F%2Fevil.com'))

    expect(location(response)).toBe(`${ORIGIN}/dashboard`)
  })

  it('offers a resend when the token hash is spent or expired', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired' } })

    const response = await confirm(link('/auth/confirm?token_hash=abc123&type=signup'))

    expect(location(response)).toContain('/login?')
    expect(location(response)).toContain('resend=1')
    expect(errorMessage(response)).toMatch(/already been used or has expired/i)
  })

  it('explains the different-browser case when the code exchange fails', async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: 'invalid request: both auth code and code verifier should be non-empty' },
    })

    const response = await confirm(link('/auth/confirm?code=abc'))

    expect(location(response)).toContain('resend=1')
    // The member must be told *why*, or they will keep re-clicking a dead link.
    expect(errorMessage(response)).toMatch(/different browser|same device/i)
  })

  it('sends an already-signed-in member on rather than showing an error', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })

    const response = await confirm(link('/auth/confirm'))

    expect(location(response)).toBe(`${ORIGIN}/dashboard`)
  })

  it('surfaces an error Supabase itself put on the link', async () => {
    const response = await confirm(
      link('/auth/confirm?error=access_denied&error_description=Email+link+is+invalid')
    )

    expect(location(response)).toContain('resend=1')
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('rejects an unknown OTP type instead of passing it to Supabase', async () => {
    const response = await confirm(link('/auth/confirm?token_hash=abc123&type=not_a_type'))

    expect(verifyOtp).not.toHaveBeenCalled()
    expect(location(response)).toContain('/login?')
  })

  it('builds redirects from the forwarded host so proxied links stay reachable', async () => {
    const response = await confirm(
      new Request('https://forming-paws.vercel.app/auth/confirm?code=abc', {
        headers: { 'x-forwarded-host': 'theplugai.xyz', 'x-forwarded-proto': 'https' },
      })
    )

    expect(location(response)).toBe(`${ORIGIN}/dashboard`)
  })
})

describe('/auth/callback', () => {
  it('exchanges an OAuth code for a session', async () => {
    const response = await callback(link('/auth/callback?code=oauth-code'))

    expect(exchangeCodeForSession).toHaveBeenCalledWith('oauth-code')
    expect(location(response)).toBe(`${ORIGIN}/dashboard`)
  })

  it('also accepts a token-hash link, so a mis-pointed template still works', async () => {
    const response = await callback(link('/auth/callback?token_hash=abc123&type=recovery'))

    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'abc123' })
    expect(location(response)).toBe(`${ORIGIN}/dashboard`)
  })

  it('reports what the provider said when sign-in was refused', async () => {
    const response = await callback(
      link('/auth/callback?error=server_error&error_description=provider+is+not+enabled')
    )

    expect(errorMessage(response)).toContain('provider is not enabled')
  })

  it('does not strand a member who already has a session', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })

    const response = await callback(link('/auth/callback'))

    expect(location(response)).toBe(`${ORIGIN}/dashboard`)
  })
})
