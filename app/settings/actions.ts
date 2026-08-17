'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  displayNameSchema,
  emailSchema,
  notificationPrefsSchema,
  isDeleteConfirmed,
} from '@/lib/validators/settings'

/**
 * Every action here returns a {ok, message} rather than throwing, because these
 * are form submissions a member should be able to correct in place — a thrown
 * error would replace the whole settings page with an error boundary and lose
 * everything else they had typed.
 */
export type ActionResult = { ok: boolean; message: string }

async function requireUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return { supabase, user: data.user }
}

export async function updateDisplayName(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = displayNameSchema.safeParse(formData.get('display_name'))
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }

  const { supabase, user } = await requireUser()
  const { error } = await supabase
    .from('owners')
    .update({ display_name: parsed.data })
    .eq('id', user.id)

  if (error) return { ok: false, message: error.message }

  revalidatePath('/settings')
  revalidatePath('/home')
  return { ok: true, message: 'Name updated.' }
}

export async function updateNotifications(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const parsed = notificationPrefsSchema.safeParse({
    notify_matches: formData.get('notify_matches') === 'on',
    notify_messages: formData.get('notify_messages') === 'on',
    notify_health_reviews: formData.get('notify_health_reviews') === 'on',
  })
  if (!parsed.success) return { ok: false, message: 'Those settings did not look right.' }

  const { supabase, user } = await requireUser()
  const { error } = await supabase.from('owners').update(parsed.data).eq('id', user.id)

  if (error) return { ok: false, message: error.message }

  revalidatePath('/settings')
  return { ok: true, message: 'Preferences saved.' }
}

/**
 * Supabase's secure-email-change default emails BOTH the old and the new
 * address, and the change lands only once both are confirmed. So this reports
 * "check your inbox", never "email changed" — claiming success here would be a
 * lie the member discovers later when their old address still works.
 */
export async function requestEmailChange(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }

  const { supabase, user } = await requireUser()
  if (parsed.data === user.email?.toLowerCase()) {
    return { ok: false, message: 'That is already your email address.' }
  }

  const { error } = await supabase.auth.updateUser({ email: parsed.data })
  if (error) return { ok: false, message: error.message }

  return {
    ok: true,
    message: `Check both inboxes. We sent a confirmation link to ${parsed.data} and to your current address — the change takes effect once both are confirmed.`,
  }
}

/**
 * "Delete my account" — deactivate now, purge later.
 *
 * A hard delete would cascade through messages.sender_owner_id and erase the
 * evidence in any open harassment report (see migration 0022). Deactivating
 * hides the member immediately, keeps the rows reviewable, and gives an
 * accidental deletion a way back.
 */
export async function deactivateAccount(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const confirmation = String(formData.get('confirmation') ?? '')
  if (!isDeleteConfirmed(confirmation)) {
    return { ok: false, message: 'Type “delete my account” exactly to confirm.' }
  }

  const { supabase } = await requireUser()
  const { error } = await supabase.rpc('deactivate_own_account')
  if (error) return { ok: false, message: error.message }

  await supabase.auth.signOut()
  redirect('/?deactivated=1')
}

export async function reactivateAccount(): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.rpc('reactivate_own_account')
  if (error) throw error

  revalidatePath('/home')
  redirect('/home')
}
