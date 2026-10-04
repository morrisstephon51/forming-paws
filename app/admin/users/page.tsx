import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/roles'
import { pageMetadata } from '@/lib/seo'
import { grantRoleAction, revokeRoleAction } from './actions'

export const metadata = pageMetadata({
  title: 'Members',
  description: 'Manage member roles.',
  path: '/admin/users',
  index: false,
})

type RoleRow = { roles: { name: string } | { name: string }[] | null }

function roleNames(rows: RoleRow[] | null | undefined): string[] {
  return (rows ?? [])
    .map((row) => (Array.isArray(row.roles) ? row.roles[0]?.name : row.roles?.name))
    .filter((n): n is string => Boolean(n))
}

export default async function UsersPage() {
  await requireRole('admin')
  const supabase = await createClient()

  const { data: owners } = await supabase
    .from('owners')
    .select('id, display_name, created_at, user_roles(roles(name))')
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: roles } = await supabase.from('roles').select('name').order('name')

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="fp-h2">Members</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Role changes are enforced by the database, not by this page. An admin cannot grant
        themselves the admin role, and the last admin cannot be removed.
      </p>

      {(owners ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">No members yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {(owners ?? []).map((owner) => {
            const held = roleNames(owner.user_roles as RoleRow[] | null)
            return (
              <li key={owner.id} className="rounded border border-hairline p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{owner.display_name}</p>
                  <p className="text-xs text-ink-soft">{held.join(', ') || 'no roles'}</p>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  Joined {new Date(owner.created_at).toLocaleDateString()}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(roles ?? []).map((role) => {
                    const has = held.includes(role.name)
                    return (
                      <form key={role.name} action={has ? revokeRoleAction : grantRoleAction}>
                        <input type="hidden" name="ownerId" value={owner.id} />
                        <input type="hidden" name="roleName" value={role.name} />
                        <button type="submit" className="rounded border border-hairline px-2 py-1 text-sm">
                          {has ? `Revoke ${role.name}` : `Grant ${role.name}`}
                        </button>
                      </form>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
