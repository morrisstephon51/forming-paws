import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function MatchesPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: myDogs } = await supabase.from('dogs').select('id').eq('owner_id', userData.user.id)
  const myDogIds = new Set((myDogs ?? []).map((d) => d.id))

  const { data: matches } = await supabase
    .from('matches')
    .select('id, matched_at, dog_a_id, dog_b_id')
    .order('matched_at', { ascending: false })

  const involvedDogIds = Array.from(
    new Set((matches ?? []).flatMap((m) => [m.dog_a_id, m.dog_b_id]))
  )
  const { data: dogRows } = involvedDogIds.length
    ? await supabase.from('dogs_browsable').select('id, name').in('id', involvedDogIds)
    : { data: [] }
  const nameById = new Map((dogRows ?? []).map((d) => [d.id, d.name]))

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your matches</h1>
        <Link href="/dashboard" className="text-sm text-gray-600 underline">
          Back to dashboard
        </Link>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        Matches are introductions only — Forming Paws is not a party to any breeding arrangement. Chat is
        coming in a later slice.
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {matches?.map((m) => {
          const mineId = myDogIds.has(m.dog_a_id) ? m.dog_a_id : m.dog_b_id
          const theirsId = myDogIds.has(m.dog_a_id) ? m.dog_b_id : m.dog_a_id
          return (
            <li key={m.id} className="border p-4 rounded">
              <p className="font-medium">
                {nameById.get(mineId) ?? 'Your dog'} ↔ {nameById.get(theirsId) ?? 'Their dog'}
              </p>
              <p className="text-sm text-gray-500">Matched {new Date(m.matched_at).toLocaleDateString()}</p>
            </li>
          )
        })}
        {matches?.length === 0 && <p className="text-gray-500">No matches yet.</p>}
      </ul>
    </main>
  )
}
