import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Supabase migrations are applied in numeric-prefix order by a hand-run runner
// (there is no CI step that applies them, so GitHub never sees a conflict when
// two PRs add differently-named files that share a prefix — every such PR shows
// MERGEABLE). When two files share a prefix the apply order between them is
// undefined, which silently reintroduced the duplicate-prefix bug this suite
// guards (originally 0022/0026/0027 — see the fix/migration-duplicate-prefixes
// work). This contract test makes that collision a red check at PR time instead
// of a latent data-layer hazard discovered during the hand-apply.
const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

function migrationPrefixes(): { file: string; prefix: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .map((file) => {
      const match = file.match(/^(\d+)_/)
      return match ? { file, prefix: match[1] } : { file, prefix: '' }
    })
}

const prefixOf = (file: string): string => file.match(/^(\d+)_/)?.[1] ?? ''

// Strip SQL comments so a reference inside `-- ...` or `/* ... */` never counts.
const stripSqlComments = (sql: string): string =>
  sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')

describe('supabase migration filenames', () => {
  it('every .sql migration starts with a numeric NNNN_ prefix', () => {
    const malformed = migrationPrefixes()
      .filter((m) => m.prefix === '')
      .map((m) => m.file)
    expect(malformed, `migrations missing a numeric prefix: ${malformed.join(', ')}`).toEqual([])
  })

  it('no two migrations share the same numeric prefix', () => {
    const byPrefix = new Map<string, string[]>()
    for (const { file, prefix } of migrationPrefixes()) {
      if (prefix === '') continue
      byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), file])
    }
    const collisions = [...byPrefix.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([prefix, files]) => `${prefix}: ${files.sort().join(' | ')}`)
    expect(
      collisions,
      `duplicate migration prefixes (undefined apply order on the hand-run Supabase runner):\n${collisions.join('\n')}`,
    ).toEqual([])
  })

  // Dependency-order guard. Unique prefixes (above) are necessary but NOT
  // sufficient: a renumber can give every file a distinct prefix yet still move a
  // migration to a position where it runs AFTER a migration that depends on it.
  // role_system is the SOLE definer of the role tables/functions
  // (public.roles, public.user_roles, grant_role(), revoke_role(), has_role(),
  // has_any_role()). Lower-numbered migrations reference them — the EARLIEST
  // executable dependent is audit_log, whose RLS policies call has_role('admin');
  // later ones revoke execute on grant_role/revoke_role and index public.user_roles.
  // Applied in numeric order, a migration cannot reference an object a higher-numbered
  // migration has not created yet, so a fresh `supabase db reset` aborts. All of these
  // names are defined ONLY in role_system, so matching them carries no
  // column/function-name ambiguity (unlike is_admin, which also exists as the
  // owners.is_admin column, so it is deliberately excluded here).
  it('role_system applies before every migration that uses its exclusive objects', () => {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .sort()
    const definer = files.find((f) => /role_system/.test(f))
    expect(definer, 'expected a *_role_system.sql migration to exist').toBeTruthy()
    const defPrefix = prefixOf(definer as string)

    const usesRoleSystem = /\b(?:grant_role|revoke_role|has_role|has_any_role)\s*\(|\bpublic\.(?:roles|user_roles)\b/i
    const violations = files
      .filter((f) => f !== definer && prefixOf(f) < defPrefix)
      .filter((f) =>
        usesRoleSystem.test(stripSqlComments(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))),
      )
      .map((f) => `${f} references a role_system object (roles/user_roles/grant_role/revoke_role) but sorts BEFORE the definer ${definer}`)
    expect(
      violations,
      `role_system (${definer}) must apply before every migration that uses its objects — ` +
        `moving it later breaks a fresh \`supabase db reset\`:\n${violations.join('\n')}`,
    ).toEqual([])
  })
})
