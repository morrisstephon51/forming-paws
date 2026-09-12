'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hasRole } from '@/lib/auth/roles'
import { recordAuditEvent } from '@/lib/auth/audit'

async function mutateRole(formData: FormData, fn: 'grant_role' | 'revoke_role') {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Unauthorized')
  if (!(await hasRole('admin'))) throw new Error('Forbidden')

  const ownerId = String(formData.get('ownerId') ?? '')
  const roleName = String(formData.get('roleName') ?? '')
  if (!ownerId || !roleName) throw new Error('ownerId and roleName are required')

  // The database is the real gate: grant_role/revoke_role re-check admin, refuse
  // self-escalation, and refuse removing the last admin. The check above only
  // produces a clearer error than a bare RPC rejection.
  const { error } = await supabase.rpc(fn, { target_owner: ownerId, role_name: roleName })
  if (error) throw new Error(error.message)

  await recordAuditEvent({
    action: fn === 'grant_role' ? 'role.grant' : 'role.revoke',
    targetType: 'owner',
    targetId: ownerId,
    detail: { role: roleName },
  })
  revalidatePath('/admin/users')
}

export async function grantRoleAction(formData: FormData) {
  await mutateRole(formData, 'grant_role')
}

export async function revokeRoleAction(formData: FormData) {
  await mutateRole(formData, 'revoke_role')
}
