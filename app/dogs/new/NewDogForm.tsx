'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { isBirthDateNotInFuture } from '@/lib/dogBirthDate'

export const dogSchema = z.object({
  name: z.string().min(1),
  breedId: z.string().min(1),
  sex: z.enum(['male', 'female']),
  // Compared as a calendar date in the member's local frame, not as a UTC
  // instant — see lib/dogBirthDate.ts for why a naive `new Date(d)` let an
  // evening "tomorrow" through west of UTC.
  birthDate: z.string().refine((d) => isBirthDateNotInFuture(d), {
    message: 'Birth date cannot be in the future',
  }),
  weightLbs: z.string().optional(),
  temperamentNotes: z.string().optional(),
})

export default function NewDogForm({ breeds }: { breeds: { id: number; name: string }[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const parsed = dogSchema.safeParse({
      name: formData.get('name'),
      breedId: formData.get('breedId'),
      sex: formData.get('sex'),
      birthDate: formData.get('birthDate'),
      weightLbs: formData.get('weightLbs'),
      temperamentNotes: formData.get('temperamentNotes'),
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

    const { error: insertError } = await supabase.from('dogs').insert({
      owner_id: userData.user.id,
      name: parsed.data.name,
      breed_id: Number(parsed.data.breedId),
      sex: parsed.data.sex,
      birth_date: parsed.data.birthDate,
      weight_lbs: parsed.data.weightLbs ? Number(parsed.data.weightLbs) : null,
      temperament_notes: parsed.data.temperamentNotes || null,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    router.push('/home')
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="fp-h2">Add a dog</h1>
      <form action={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input name="name" placeholder="Dog's name" required className="border border-hairline p-2" />
        <select name="breedId" required className="border border-hairline p-2">
          <option value="">Select breed</option>
          {breeds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="sex" required className="border border-hairline p-2">
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <input name="birthDate" type="date" required className="border border-hairline p-2" />
        <input name="weightLbs" type="number" placeholder="Weight (lbs)" className="border border-hairline p-2" />
        <textarea name="temperamentNotes" placeholder="Temperament notes" className="border border-hairline p-2" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="fp-btn">
          Save
        </button>
      </form>
    </main>
  )
}
