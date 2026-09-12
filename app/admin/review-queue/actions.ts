'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { hasRole } from '@/lib/auth/roles'

export async function reviewDocument(
  docId: string,
  decision: string,
  notes: string
) {
  if (decision !== 'verified' && decision !== 'rejected') {
    throw new Error('Invalid decision')
  }

  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Unauthorized')

  if (!(await hasRole('admin'))) throw new Error('Forbidden')

  const { error } = await supabase
    .from('health_documents')
    .update({ status: decision, reviewed_at: new Date().toISOString(), reviewer_notes: notes || null })
    .eq('id', docId)

  if (error) throw error
  revalidatePath('/admin/review-queue')
}
