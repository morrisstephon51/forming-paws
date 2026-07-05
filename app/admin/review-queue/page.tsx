import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { reviewDocument } from './actions'

export default async function ReviewQueuePage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: owner } = await supabase
    .from('owners')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single()
  if (!owner?.is_admin) redirect('/dashboard')

  const { data: pendingDocs } = await supabase
    .from('health_documents')
    .select('id, doc_type, document_date, storage_path, dogs(name)')
    .eq('status', 'pending_review')
    .order('uploaded_at')

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Health document review queue</h1>
      <ul className="mt-6 flex flex-col gap-4">
        {pendingDocs?.map((doc) => (
          <li key={doc.id} className="border p-4 rounded">
            <p className="font-medium">
              {(doc.dogs as unknown as { name: string })?.name} — {doc.doc_type} ({doc.document_date})
            </p>
            <form
              action={async (formData: FormData) => {
                'use server'
                await reviewDocument(
                  doc.id,
                  formData.get('decision') as 'verified' | 'rejected',
                  String(formData.get('notes') || '')
                )
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
        {pendingDocs?.length === 0 && <p className="text-gray-500">Nothing pending review.</p>}
      </ul>
    </main>
  )
}
