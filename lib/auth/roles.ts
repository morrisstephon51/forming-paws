import { redirect } from 'next/navigation'
import { loginRedirectPath } from '@/lib/auth/login-redirect'
import { createClient } from '@/lib/supabase/server'

type Options = { redirectTo?: string }

/**
 * Role checks resolve in the database, not here. `has_role` / `has_any_role`
 * are security-definer SQL functions reading public.user_roles, so the same
 * answer backs RLS policies, server actions, and nav rendering. Never re-derive
 * a role from a column in application code — that is the drift this replaces.
 */
export async function hasRole(role: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('has_role', { role_name: role })
  return data === true
}

/**
 * Gate a page on a single role. Signed-out callers go to /login; signed-in
 * callers without the role go to /home — the behaviour the six original admin
 * files each implemented by hand.
 */
export async function requireRole(role: string, opts: Options = {}): Promise<{ userId: string }> {
  return requireAnyRole([role], opts)
}

export async function requireAnyRole(
  roles: string[],
  opts: Options = {},
): Promise<{ userId: string }> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect(await loginRedirectPath())

  const { data } = await supabase.rpc('has_any_role', { role_names: roles })
  if (data !== true) redirect(opts.redirectTo ?? '/home')

  return { userId: userData.user.id }
}
