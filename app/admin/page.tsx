import { requireRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { pageMetadata } from '@/lib/seo'
import DashboardView from '@/components/admin/DashboardView'
import type { DashboardStats } from '@/lib/admin/dashboard'

export const metadata = pageMetadata({
  title: 'Overview',
  description: 'Where the platform stands and what needs doing.',
  path: '/admin',
  index: false,
})

/**
 * The admin console's home.
 *
 * The role is enforced three times: by the admin layout, here, and inside
 * admin_dashboard_stats() itself, so a route reached outside the layout is
 * still protected and a direct RPC call is refused by the database.
 */
export default async function AdminOverviewPage() {
  await requireRole('admin')
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('admin_dashboard_stats')
  if (error) console.error('admin_dashboard_stats failed:', error.message)
  const stats = error || !data ? null : (data as DashboardStats)

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="fp-h2">Overview</h1>
      <DashboardView stats={stats} now={new Date()} />
    </main>
  )
}
