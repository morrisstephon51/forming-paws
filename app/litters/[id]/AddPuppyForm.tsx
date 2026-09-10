'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { newPuppySchema } from '@/lib/validators/litter'

export default function AddPuppyForm({
  litterId,
  defaultBirthDate,
}: {
  litterId: string
  defaultBirthDate: string | null
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const parsed = newPuppySchema.safeParse({
      name: formData.get('name'),
      sex: formData.get('sex'),
      birthDate: formData.get('birthDate'),
      priceDollars: formData.get('priceDollars') || undefined,
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setError('Not signed in')
      return
    }

    // Puppies share the parents' breed -- fetched from the litter's sire
    // rather than asked again, since it can only ever be one answer.
    const { data: litter } = await supabase
      .from('litters')
      .select('sire_id')
      .eq('id', litterId)
      .single()
    const { data: sireDog } = await supabase
      .from('dogs')
      .select('breed_id')
      .eq('id', litter?.sire_id)
      .single()

    if (!sireDog) {
      setError('Could not find this litter’s breed')
      return
    }

    const priceCents = parsed.data.priceDollars
      ? Math.round(Number(parsed.data.priceDollars) * 100)
      : null

    const { error: insertError } = await supabase.from('dogs').insert({
      owner_id: userData.user.id,
      litter_id: litterId,
      name: parsed.data.name,
      breed_id: sireDog.breed_id,
      sex: parsed.data.sex,
      birth_date: parsed.data.birthDate,
      listed_price_cents: priceCents,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    router.refresh()
  }

  return (
    <form action={handleSubmit} className="fp-card mt-4 flex flex-col gap-3">
      <p className="fp-h5">Add a puppy</p>
      <div className="flex flex-wrap gap-3">
        <input name="name" placeholder="Name" required className="fp-input text-sm" />
        <select name="sex" required className="fp-input text-sm">
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <input
          name="birthDate"
          type="date"
          required
          defaultValue={defaultBirthDate ?? ''}
          className="fp-input text-sm"
        />
        <input
          name="priceDollars"
          type="number"
          min="0"
          step="1"
          placeholder="Price (optional)"
          className="fp-input text-sm"
        />
        <button type="submit" className="fp-btn px-4 py-1.5 text-sm">
          Add
        </button>
      </div>
      <p className="text-xs text-ink-soft">
        The price is shown to buyers as information only. Forming Paws never processes payment for
        a puppy.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
