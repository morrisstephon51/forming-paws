'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendMessage(matchId: string, body: string) {
  const trimmed = body.trim()
  if (trimmed.length === 0) throw new Error('Message is empty')
  if (trimmed.length > 2000) throw new Error('Message is too long (2000 characters maximum)')

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')

  // No participant or block check here on purpose: RLS enforces both, so a
  // stale client cannot post into a thread it no longer belongs to, and there
  // is no second place for the rule to drift out of sync.
  const { error } = await supabase
    .from('messages')
    .insert({ match_id: matchId, sender_owner_id: userData.user.id, body: trimmed })

  if (error) {
    throw new Error('Could not send that message. The conversation may have been closed.')
  }

  revalidatePath(`/matches/${matchId}`)
  revalidatePath('/matches')
}

/**
 * Marks a thread read. Deliberately never throws.
 *
 * This is bookkeeping for a badge. An admin reading a reported conversation is
 * not a participant, so the match_reads insert policy rejects them — and an
 * unread marker failing must not take down the page someone is trying to read.
 * Verified against the live database: the rejection is
 * "new row violates row-level security policy for table match_reads".
 */
export async function markRead(matchId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return

  await supabase.from('match_reads').upsert(
    { match_id: matchId, owner_id: userData.user.id, last_read_at: new Date().toISOString() },
    { onConflict: 'match_id,owner_id' }
  )
}

export async function blockMatch(matchId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')

  const { error } = await supabase.from('match_blocks').upsert(
    { match_id: matchId, blocker_owner_id: userData.user.id },
    { onConflict: 'match_id,blocker_owner_id' }
  )

  if (error) throw error
  revalidatePath(`/matches/${matchId}`)
  revalidatePath('/matches')
}

export async function unblockMatch(matchId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')

  // Removes only MY block. If the other party also blocked, the thread stays
  // closed, which is the correct outcome.
  const { error } = await supabase
    .from('match_blocks')
    .delete()
    .eq('match_id', matchId)
    .eq('blocker_owner_id', userData.user.id)

  if (error) throw error
  revalidatePath(`/matches/${matchId}`)
  revalidatePath('/matches')
}

const REPORT_REASONS = new Set([
  'harassment',
  'spam',
  'animal_welfare',
  'suspected_fake_documents',
  'other',
])

export async function reportMatch(matchId: string, reason: string, detail: string) {
  if (!REPORT_REASONS.has(reason)) throw new Error('Pick a reason')
  const trimmed = detail.trim()
  if (trimmed.length > 1000) throw new Error('Please keep the detail under 1000 characters')

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')

  const { error } = await supabase.from('match_reports').insert({
    match_id: matchId,
    reporter_owner_id: userData.user.id,
    reason,
    detail: trimmed || null,
  })

  if (error) throw error
  revalidatePath(`/matches/${matchId}`)
}
