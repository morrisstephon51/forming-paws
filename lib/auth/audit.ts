import { createClient } from '@/lib/supabase/server'

/**
 * Append a row to the audit log. This throws rather than warning: an audit
 * write that fails quietly is worse than one that fails loudly, because the
 * privileged action it was meant to record has already happened.
 */
export async function recordAuditEvent(input: {
  action: string
  targetType: string
  targetId?: string
  detail?: Record<string, unknown>
}): Promise<void> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Cannot record an audit event without an actor')

  const { error } = await supabase.from('audit_log').insert({
    actor_id: userData.user.id,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    detail: input.detail ?? {},
  })
  if (error) throw new Error(`Audit write failed: ${error.message}`)
}
