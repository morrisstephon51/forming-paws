import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/roles'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Audit log',
  description: 'Record of privileged actions.',
  path: '/admin/audit-log',
  index: false,
})

export default async function AuditLogPage() {
  await requireRole('admin')
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('audit_log')
    .select('id, action, target_type, target_id, detail, created_at, owners(display_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="fp-h2">Audit log</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Append-only. There is no update or delete policy on this table, so a recorded action
        cannot be edited away.
      </p>

      {(events ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">No events recorded yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline">
                <th scope="col" className="py-2 pr-4 font-medium">When</th>
                <th scope="col" className="py-2 pr-4 font-medium">Actor</th>
                <th scope="col" className="py-2 pr-4 font-medium">Action</th>
                <th scope="col" className="py-2 font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {(events ?? []).map((e) => {
                const actor = Array.isArray(e.owners) ? e.owners[0] : e.owners
                return (
                  <tr key={e.id} className="border-b border-hairline/50">
                    <td className="py-2 pr-4 whitespace-nowrap text-ink-soft">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{actor?.display_name ?? 'system'}</td>
                    <td className="py-2 pr-4">{e.action}</td>
                    <td className="py-2 text-ink-soft">
                      {e.target_type}
                      {e.target_id ? ` · ${e.target_id.slice(0, 8)}…` : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
