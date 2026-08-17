import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { setReportStatus } from './actions'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Reported conversations',
  description: 'Review conversations members have reported.',
  path: '/admin/reports',
  index: false,
})

const REASON_LABELS: Record<string, string> = {
  harassment: 'Harassment',
  animal_welfare: 'Animal welfare',
  suspected_fake_documents: 'Suspected fake documents',
  spam: 'Spam',
  other: 'Other',
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: owner } = await supabase
    .from('owners')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single()
  if (!owner?.is_admin) redirect('/home')

  const { data: reports } = await supabase
    .from('match_reports')
    .select('id, match_id, reason, detail, status, created_at')
    .in('status', ['open', 'reviewing'])
    .order('created_at')

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Reported conversations</h1>
      <p className="mt-2 text-sm text-ink-soft">
        You can read a reported conversation while its report is open or being reviewed. Resolving or
        dismissing it ends that access — that limit is enforced by the database, not by this page.
      </p>
      <ul className="mt-6 flex flex-col gap-4">
        {reports?.map((r) => (
          <li key={r.id} className="rounded border p-4">
            <p className="font-medium">{REASON_LABELS[r.reason] ?? r.reason}</p>
            {r.detail && <p className="mt-1 text-sm text-ink-soft">{r.detail}</p>}
            <p className="mt-1 text-xs text-ink-soft">
              Reported {new Date(r.created_at).toLocaleDateString()} · status {r.status}
            </p>
            <Link href={`/matches/${r.match_id}`} className="mt-2 inline-block text-sm underline">
              Read the conversation
            </Link>
            <form
              action={async (formData: FormData) => {
                'use server'
                await setReportStatus(
                  r.id,
                  String(formData.get('status')),
                  String(formData.get('notes') ?? '')
                )
              }}
              className="mt-3 flex flex-wrap items-center gap-2"
            >
              <select name="status" defaultValue="reviewing" className="rounded border p-1.5 text-sm">
                <option value="reviewing">Reviewing</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
              <input
                name="notes"
                placeholder="Reviewer notes"
                className="flex-1 rounded border p-1.5 text-sm"
              />
              <button type="submit" className="rounded bg-brand px-3 py-1.5 text-sm text-white">
                Save
              </button>
            </form>
          </li>
        ))}
        {reports?.length === 0 && <p className="text-ink-soft">Nothing reported. 🎉</p>}
      </ul>
    </main>
  )
}
