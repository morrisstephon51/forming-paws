'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { newLitterSchema } from '@/lib/validators/litter'
import SageNote from '@/components/mascot/SageNote'

type Dog = { id: string; name: string; sex: 'male' | 'female'; isVerified: boolean }

export default function NewLitterForm({ dogs }: { dogs: Dog[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const sires = dogs.filter((d) => d.sex === 'male' && d.isVerified)
  const dams = dogs.filter((d) => d.sex === 'female' && d.isVerified)

  if (sires.length === 0 || dams.length === 0) {
    return (
      <main className="mx-auto max-w-sm p-8">
        <h1 className="fp-h2">List a litter</h1>
        <SageNote mood="thinking" title="You need a verified male and a verified female" className="mt-6">
          A litter needs two of your own dogs, one of each sex, both already health-verified.{' '}
          <a href="/home" className="font-semibold text-brand underline">
            Check your dogs&apos; verification status
          </a>
          .
        </SageNote>
      </main>
    )
  }

  async function handleSubmit(formData: FormData) {
    const parsed = newLitterSchema.safeParse({
      sireId: formData.get('sireId'),
      damId: formData.get('damId'),
      bornOn: formData.get('bornOn') || undefined,
      readyOn: formData.get('readyOn') || undefined,
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

    const { data: litter, error: insertError } = await supabase
      .from('litters')
      .insert({
        breeder_id: userData.user.id,
        sire_id: parsed.data.sireId,
        dam_id: parsed.data.damId,
        born_on: parsed.data.bornOn ?? null,
        ready_on: parsed.data.readyOn ?? null,
      })
      .select('id')
      .single()

    if (insertError) {
      // A denied insert means one of the database's own checks failed (not
      // verified, not your dog, or the 1-litter-per-dog-per-year cap) --
      // RLS returns a generic denial, not which check, so the message stays
      // general rather than guessing.
      setError(
        insertError.code === '42501'
          ? "That litter couldn't be created. Check that both dogs are verified and haven't already started a litter in the last 12 months."
          : insertError.message
      )
      return
    }

    router.push(`/litters/${litter.id}`)
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="fp-h2">List a litter</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Puppies go on the marketplace once you add them here. No payment moves through Forming
        Paws -- buyers reach out, and you arrange the rest.
      </p>
      <form action={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="text-sm font-medium">
          Sire (male)
          <select name="sireId" required className="fp-input mt-1 w-full">
            {sires.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Dam (female)
          <select name="damId" required className="fp-input mt-1 w-full">
            {dams.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Born on (if known)
          <input name="bornOn" type="date" className="fp-input mt-1 w-full" />
        </label>
        <label className="text-sm font-medium">
          Ready for their new home on (if known)
          <input name="readyOn" type="date" className="fp-input mt-1 w-full" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="fp-btn">
          Start litter
        </button>
      </form>
    </main>
  )
}
