'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hasRole } from '@/lib/auth/roles'
import { recordAuditEvent } from '@/lib/auth/audit'

const SEXES = ['male', 'female'] as const

/**
 * Every action in this file gates the same way app/admin/users/actions.ts does.
 * The database is the real gate — admin_remove_dog and admin_restore_dog
 * re-check is_admin(), and dogs_update_admin governs the direct update. The
 * check here only produces a clearer error than a bare RPC rejection.
 */
async function adminClient() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Unauthorized')
  if (!(await hasRole('admin'))) throw new Error('Forbidden')
  return supabase
}

function requiredString(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? '').trim()
  if (!value) throw new Error(`${key} is required`)
  return value
}

/** '' means "clear it" for the nullable columns, not "write an empty string". */
function optionalNumber(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim()
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new Error(`${key} must be a number`)
  return n
}

export async function updateDogAction(formData: FormData) {
  const supabase = await adminClient()

  const dogId = requiredString(formData, 'dogId')
  const name = requiredString(formData, 'name')
  const breedId = Number(requiredString(formData, 'breedId'))
  if (!Number.isFinite(breedId)) throw new Error('breedId must be a number')
  const sex = requiredString(formData, 'sex')
  if (!SEXES.includes(sex as (typeof SEXES)[number])) throw new Error('sex must be male or female')
  const birthDate = requiredString(formData, 'birthDate')

  const patch = {
    name,
    breed_id: breedId,
    sex,
    birth_date: birthDate,
    weight_lbs: optionalNumber(formData, 'weightLbs'),
    temperament_notes: String(formData.get('temperamentNotes') ?? '').trim() || null,
    listed_price_cents: optionalNumber(formData, 'listedPriceCents'),
  }

  const { error } = await supabase.from('dogs').update(patch).eq('id', dogId)
  if (error) throw new Error(error.message)

  await recordAuditEvent({
    action: 'dog.update',
    targetType: 'dog',
    targetId: dogId,
    detail: { fields: Object.keys(patch) },
  })
  revalidatePath('/admin/dogs')
}

export async function removeDogAction(formData: FormData) {
  const supabase = await adminClient()
  const dogId = requiredString(formData, 'dogId')
  const reason = String(formData.get('reason') ?? '').trim() || null

  const { error } = await supabase.rpc('admin_remove_dog', { p_dog_id: dogId, p_reason: reason })
  if (error) throw new Error(error.message)

  await recordAuditEvent({
    action: 'dog.remove',
    targetType: 'dog',
    targetId: dogId,
    detail: reason ? { reason } : {},
  })
  revalidatePath('/admin/dogs')
}

export async function restoreDogAction(formData: FormData) {
  const supabase = await adminClient()
  const dogId = requiredString(formData, 'dogId')

  const { error } = await supabase.rpc('admin_restore_dog', { p_dog_id: dogId })
  if (error) throw new Error(error.message)

  await recordAuditEvent({ action: 'dog.restore', targetType: 'dog', targetId: dogId })
  revalidatePath('/admin/dogs')
}

/**
 * Reassignment moves a dog, its photos and its health documents between two
 * real people. It is the most dangerous single write in the console, so it
 * requires the dog's name typed back before it will run.
 */
export async function reassignDogAction(formData: FormData) {
  const supabase = await adminClient()

  const dogId = requiredString(formData, 'dogId')
  const newOwnerId = requiredString(formData, 'newOwnerId')
  const dogName = requiredString(formData, 'dogName')
  const confirmName = String(formData.get('confirmName') ?? '').trim()
  if (confirmName !== dogName) throw new Error('Confirmation did not match the dog name')

  const previousOwnerId = String(formData.get('previousOwnerId') ?? '') || null

  const { error } = await supabase.from('dogs').update({ owner_id: newOwnerId }).eq('id', dogId)
  if (error) throw new Error(error.message)

  await recordAuditEvent({
    action: 'dog.reassign',
    targetType: 'dog',
    targetId: dogId,
    detail: { fromOwnerId: previousOwnerId, toOwnerId: newOwnerId },
  })
  revalidatePath('/admin/dogs')
}
