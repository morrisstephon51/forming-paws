'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markHandled(messageId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Unauthorized')

  // Checked here as well as in RLS. The database is what actually enforces it;
  // this is so an admin-only page fails with a clear error instead of an
  // update that silently affects zero rows.
  const { data: owner } = await supabase
    .from('owners')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single()
  if (!owner?.is_admin) throw new Error('Forbidden')

  const { error } = await supabase
    .from('contact_messages')
    .update({ handled_at: new Date().toISOString(), handled_by: userData.user.id })
    .eq('id', messageId)

  if (error) throw error
  revalidatePath('/admin/messages')
}
