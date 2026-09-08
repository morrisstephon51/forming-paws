import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  auditInsert: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

/**
 * Stands in for the Supabase server client. Every action calls createClient
 * directly, hasRole calls it a second time, and recordAuditEvent a third — all
 * three resolve to this same object, so it has to answer has_role, the dogs
 * update, the RPCs, and the audit_log insert at once.
 *
 * `.eq` is what gets awaited, so the resolved { error } must hang off it. If it
 * hung off `.update`, `const { error } = await ...` would be undefined and a
 * broken action would pass.
 */
function client({ user, roles, updateError = null, rpcError = null }: {
  user: string | null
  roles: string[]
  updateError?: { message: string } | null
  rpcError?: { message: string } | null
}) {
  return {
    auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'has_role') return { data: roles.includes(String(args.role_name)), error: null }
      mocks.rpc(fn, args)
      return { data: null, error: rpcError }
    },
    from: (table: string) => {
      if (table === 'audit_log') {
        return { insert: async (row: Record<string, unknown>) => { mocks.auditInsert(row); return { error: null } } }
      }
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: async (col: string, val: string) => {
            mocks.update(table, patch, col, val)
            return { error: updateError }
          },
        }),
      }
    },
  }
}

function fd(entries: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.append(k, v)
  return f
}

beforeEach(() => {
  mocks.createClient.mockReset()
  mocks.revalidatePath.mockReset()
  mocks.rpc.mockReset()
  mocks.update.mockReset()
  mocks.auditInsert.mockReset()
})

describe('removeDogAction', () => {
  it('calls admin_remove_dog and records an audit event', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'admin1', roles: ['admin'] }))
    const { removeDogAction } = await import('@/app/admin/dogs/actions')
    await removeDogAction(fd({ dogId: 'dog-1', reason: 'spam' }))

    expect(mocks.rpc).toHaveBeenCalledWith('admin_remove_dog', { p_dog_id: 'dog-1', p_reason: 'spam' })
    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dog.remove', target_type: 'dog', target_id: 'dog-1' }),
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/dogs')
  })

  it('refuses a non-admin before touching the database', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'plain1', roles: [] }))
    const { removeDogAction } = await import('@/app/admin/dogs/actions')
    await expect(removeDogAction(fd({ dogId: 'dog-1' }))).rejects.toThrow('Forbidden')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('refuses a signed-out caller', async () => {
    mocks.createClient.mockResolvedValue(client({ user: null, roles: [] }))
    const { removeDogAction } = await import('@/app/admin/dogs/actions')
    await expect(removeDogAction(fd({ dogId: 'dog-1' }))).rejects.toThrow('Unauthorized')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.auditInsert).not.toHaveBeenCalled()
  })

  it('surfaces a database refusal and records nothing', async () => {
    mocks.createClient.mockResolvedValue(
      client({ user: 'admin1', roles: ['admin'], rpcError: { message: 'already removed' } }),
    )
    const { removeDogAction } = await import('@/app/admin/dogs/actions')
    await expect(removeDogAction(fd({ dogId: 'dog-1' }))).rejects.toThrow('already removed')
    expect(mocks.auditInsert).not.toHaveBeenCalled()
  })
})

describe('restoreDogAction', () => {
  it('calls admin_restore_dog and audits it', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'admin1', roles: ['admin'] }))
    const { restoreDogAction } = await import('@/app/admin/dogs/actions')
    await restoreDogAction(fd({ dogId: 'dog-2' }))
    expect(mocks.rpc).toHaveBeenCalledWith('admin_restore_dog', { p_dog_id: 'dog-2' })
    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dog.restore', target_id: 'dog-2' }),
    )
  })

  it('refuses a non-admin before touching the database', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'plain1', roles: [] }))
    const { restoreDogAction } = await import('@/app/admin/dogs/actions')
    await expect(restoreDogAction(fd({ dogId: 'dog-2' }))).rejects.toThrow('Forbidden')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('refuses a signed-out caller', async () => {
    mocks.createClient.mockResolvedValue(client({ user: null, roles: [] }))
    const { restoreDogAction } = await import('@/app/admin/dogs/actions')
    await expect(restoreDogAction(fd({ dogId: 'dog-2' }))).rejects.toThrow('Unauthorized')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.auditInsert).not.toHaveBeenCalled()
  })

  it('surfaces a database refusal and records nothing', async () => {
    mocks.createClient.mockResolvedValue(
      client({ user: 'admin1', roles: ['admin'], rpcError: { message: 'already restored' } }),
    )
    const { restoreDogAction } = await import('@/app/admin/dogs/actions')
    await expect(restoreDogAction(fd({ dogId: 'dog-2' }))).rejects.toThrow('already restored')
    expect(mocks.auditInsert).not.toHaveBeenCalled()
  })
})

describe('updateDogAction', () => {
  it('writes only the editable fields', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'admin1', roles: ['admin'] }))
    const { updateDogAction } = await import('@/app/admin/dogs/actions')
    await updateDogAction(fd({
      dogId: 'dog-3',
      name: 'Rex',
      breedId: '4',
      sex: 'male',
      birthDate: '2022-01-01',
      weightLbs: '30',
      temperamentNotes: 'calm',
      listedPriceCents: '',
    }))

    expect(mocks.update).toHaveBeenCalledWith(
      'dogs',
      {
        name: 'Rex',
        breed_id: 4,
        sex: 'male',
        birth_date: '2022-01-01',
        weight_lbs: 30,
        temperament_notes: 'calm',
        listed_price_cents: null,
      },
      'id',
      'dog-3',
    )
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('owner_id')
  })

  it('rejects an unknown sex before writing', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'admin1', roles: ['admin'] }))
    const { updateDogAction } = await import('@/app/admin/dogs/actions')
    await expect(
      updateDogAction(fd({ dogId: 'dog-3', name: 'Rex', breedId: '4', sex: 'unknown', birthDate: '2022-01-01' })),
    ).rejects.toThrow('sex must be male or female')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('refuses a non-admin without reporting input problems', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'plain1', roles: [] }))
    const { updateDogAction } = await import('@/app/admin/dogs/actions')
    // Deliberately malformed. The gate runs first, so the caller learns they are
    // not allowed in — not which of their fields was wrong.
    await expect(updateDogAction(fd({ dogId: '', name: '' }))).rejects.toThrow('Forbidden')
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

describe('reassignDogAction', () => {
  it('requires the typed dog name to match', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'admin1', roles: ['admin'] }))
    const { reassignDogAction } = await import('@/app/admin/dogs/actions')
    await expect(
      reassignDogAction(fd({ dogId: 'dog-4', newOwnerId: 'o2', dogName: 'Rex', confirmName: 'rexx' })),
    ).rejects.toThrow('Confirmation did not match')
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.auditInsert).not.toHaveBeenCalled()
  })

  it('reassigns and audits both owners when the name matches', async () => {
    mocks.createClient.mockResolvedValue(client({ user: 'admin1', roles: ['admin'] }))
    const { reassignDogAction } = await import('@/app/admin/dogs/actions')
    await reassignDogAction(fd({
      dogId: 'dog-4', newOwnerId: 'o2', dogName: 'Rex', confirmName: 'Rex', previousOwnerId: 'o1',
    }))
    expect(mocks.update).toHaveBeenCalledWith('dogs', { owner_id: 'o2' }, 'id', 'dog-4')
    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'dog.reassign',
        detail: { fromOwnerId: 'o1', toOwnerId: 'o2' },
      }),
    )
  })
})
