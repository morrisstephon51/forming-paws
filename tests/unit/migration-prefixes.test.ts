import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
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
})
