import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { STATS } from './fixtures/dashboard-stats'

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  isAdmin: true,
  rpcResult: { data: null as unknown, error: null as { message: string } | null },
  rpcCalls: [] as string[],
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mocks.redirect(path)
    throw new Error('NEXT_REDIRECT')
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } } }) },
    rpc: async (fn: string) => {
      mocks.rpcCalls.push(fn)
      if (fn === 'has_any_role') return { data: mocks.isAdmin, error: null }
      if (fn === 'admin_dashboard_stats') return mocks.rpcResult
      throw new Error(`unexpected rpc ${fn}`)
    },
  }),
}))

import AdminOverviewPage from '@/app/admin/page'

beforeEach(() => {
  mocks.redirect.mockClear()
  mocks.isAdmin = true
  mocks.rpcResult = { data: STATS, error: null }
  mocks.rpcCalls = []
})

describe('/admin overview page', () => {
  it('renders the dashboard for an admin from a single stats call', async () => {
    render(await AdminOverviewPage())
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Needs attention' })).toBeInTheDocument()
    expect(mocks.rpcCalls.filter((fn) => fn === 'admin_dashboard_stats')).toHaveLength(1)
  })

  it('sends a signed-in non-admin home without ever asking for stats', async () => {
    mocks.isAdmin = false
    await expect(AdminOverviewPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/home')
    expect(mocks.rpcCalls).not.toContain('admin_dashboard_stats')
  })

  it('shows the failure record, and logs the error, when the stats call fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.rpcResult = { data: null, error: { message: 'boom' } }
    render(await AdminOverviewPage())
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load figures")
    expect(log).toHaveBeenCalledWith('admin_dashboard_stats failed:', 'boom')
    log.mockRestore()
  })
})
