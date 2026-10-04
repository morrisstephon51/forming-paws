import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn(),
  // The page middleware reports as requested, via the x-fp-path request header.
  requestedPath: { value: null as string | null },
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers(mocks.requestedPath.value ? { 'x-fp-path': mocks.requestedPath.value } : {}),
}))
vi.mock('next/navigation', () => ({
  redirect: (p: string) => {
    mocks.redirect(p)
    throw new Error('NEXT_REDIRECT')
  },
}))

/**
 * Stands in for the Supabase server client. `roles` is the set of role names the
 * signed-in owner holds; has_role/has_any_role are answered from it the same way
 * the security-definer SQL functions would.
 */
function client({ user, roles }: { user: string | null; roles: string[] }) {
  return {
    auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) },
    rpc: async (fn: string, args: { role_name?: string; role_names?: string[] }) => {
      if (fn === 'has_role') return { data: roles.includes(args.role_name ?? ''), error: null }
      if (fn === 'has_any_role') {
        return { data: (args.role_names ?? []).some((r) => roles.includes(r)), error: null }
      }
      throw new Error(`unexpected rpc: ${fn}`)
    },
  }
}

describe('requireRole', () => {
  beforeEach(() => {
    mocks.redirect.mockReset()
    mocks.createClient.mockReset()
    mocks.requestedPath.value = null
  })

  it('returns the user id when the role is held', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'u1', roles: ['admin'] }))
    const { requireRole } = await import('@/lib/auth/roles')
    await expect(requireRole('admin')).resolves.toEqual({ userId: 'u1' })
  })

  it('redirects to /login when signed out', async () => {
    mocks.createClient.mockResolvedValue(client({ user: null, roles: [] }))
    const { requireRole } = await import('@/lib/auth/roles')
    await expect(requireRole('admin')).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/login')
  })

  // An admin opening /admin/users in a browser where they are not signed in
  // must come back to /admin/users, not land on /home with no way to the console.
  it('carries the requested page to /login when signed out', async () => {
    mocks.requestedPath.value = '/admin/users'
    mocks.createClient.mockResolvedValue(client({ user: null, roles: [] }))
    const { requireRole } = await import('@/lib/auth/roles')
    await expect(requireRole('admin')).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/login?next=%2Fadmin%2Fusers')
  })

  it('redirects to /home when the role is missing', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'u2', roles: ['breeder'] }))
    const { requireRole } = await import('@/lib/auth/roles')
    await expect(requireRole('admin')).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/home')
  })

  it('honours an explicit redirectTo', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'u2', roles: [] }))
    const { requireRole } = await import('@/lib/auth/roles')
    await expect(requireRole('admin', { redirectTo: '/account' })).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/account')
  })

  it('requireAnyRole passes when one of several roles is held', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'u3', roles: ['moderator'] }))
    const { requireAnyRole } = await import('@/lib/auth/roles')
    await expect(requireAnyRole(['admin', 'moderator'])).resolves.toEqual({ userId: 'u3' })
  })
})

describe('hasRole', () => {
  beforeEach(() => mocks.createClient.mockReset())

  it('is true when held and false when not', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'u4', roles: ['admin'] }))
    const { hasRole } = await import('@/lib/auth/roles')
    await expect(hasRole('admin')).resolves.toBe(true)
    await expect(hasRole('breeder')).resolves.toBe(false)
  })

  it('is false when signed out rather than throwing', async () => {
    mocks.createClient.mockResolvedValue(client({ user: null, roles: [] }))
    const { hasRole } = await import('@/lib/auth/roles')
    await expect(hasRole('admin')).resolves.toBe(false)
  })
})
