'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const STATUSES = new Set(['open', 'reviewing', 'resolved', 'dismissed'])

export async function setReportStatus(reportId: string, status: string, notes: string) {
  if (!STATUSES.has(status)) throw new Error('Invalid status')

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Unauthorized')

  const { data: owner } = await supabase
    .from('owners')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single()
  if (!owner?.is_admin) throw new Error('Forbidden')

  const { error } = await supabase
    .from('match_reports')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes || null,
    })
    .eq('id', reportId)

  if (error) throw error
  revalidatePath('/admin/reports')
}
