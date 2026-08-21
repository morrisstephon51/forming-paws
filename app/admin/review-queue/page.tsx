import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { reviewDocument } from './actions'
import { pageMetadata } from '@/lib/seo'
import { formatCalendarDate } from '@/lib/dates'

export const metadata = pageMetadata({
  title: 'Health document review',
  description: 'Review and verify submitted veterinary documents.',
  path: '/admin/review-queue',
  index: false,
})

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error: reviewError } = await searchParams
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: owner } = await supabase
    .from('owners')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single()
  if (!owner?.is_admin) redirect('/home')

  const { data: pendingDocs } = await supabase
    .from('health_documents')
    .select('id, doc_type, document_date, storage_path, dog_id')
    .eq('status', 'pending_review')
    .order('uploaded_at')

  const dogIds = Array.from(new Set((pendingDocs ?? []).map((d) => d.dog_id)))
  const { data: dogRows } = dogIds.length
    ? await supabase.from('dogs_browsable').select('id, name').in('id', dogIds)
    : { data: [] }
  const nameById = new Map((dogRows ?? []).map((d) => [d.id, d.name]))

  const docs = await Promise.all(
    (pendingDocs ?? []).map(async (doc) => {
      const { data } = await supabase.storage.from('health-docs').createSignedUrl(doc.storage_path, 3600)
      return { ...doc, dogName: nameById.get(doc.dog_id), url: data?.signedUrl }
    })
  )

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="fp-h2">Health document review queue</h1>
      {reviewError && (
        <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-600">
          Failed to save review: {reviewError}
        </p>
      )}
      <ul className="mt-6 flex flex-col gap-4">
        {docs.map((doc) => (
          <li key={doc.id} className="border p-4 rounded">
            <p className="font-medium">
              {doc.dogName ?? 'Unknown dog'} — {doc.doc_type} ({formatCalendarDate(doc.document_date)})
            </p>
            {doc.url ? (
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 underline"
              >
                View document
              </a>
            ) : (
              <p className="text-sm text-ink-soft">Document unavailable</p>
            )}
            <form
              action={async (formData: FormData) => {
                'use server'
                try {
                  await reviewDocument(
                    doc.id,
                    String(formData.get('decision') || ''),
                    String(formData.get('notes') || '')
                  )
                } catch (err) {
                  redirect(
                    `/admin/review-queue?error=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`
                  )
                }
              }}
              className="mt-2 flex gap-2 items-center"
            >
              <input name="notes" placeholder="Notes (optional)" className="border p-1 text-sm flex-1" />
              <button name="decision" value="verified" className="bg-green-600 text-white px-3 py-1 rounded text-sm">
                Verify
              </button>
              <button name="decision" value="rejected" className="bg-red-600 text-white px-3 py-1 rounded text-sm">
                Reject
              </button>
            </form>
          </li>
        ))}
        {docs.length === 0 && <p className="text-ink-soft">Nothing pending review.</p>}
      </ul>
    </main>
  )
}
