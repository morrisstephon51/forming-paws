'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function reviewDocument(
  docId: string,
  decision: string,
  notes: string
) {
  if (decision !== 'verified' && decision !== 'rejected') {
    throw new Error('Invalid decision')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('health_documents')
    .update({ status: decision, reviewed_at: new Date().toISOString(), reviewer_notes: notes || null })
    .eq('id', docId)

  if (error) throw error
  revalidatePath('/admin/review-queue')
}
