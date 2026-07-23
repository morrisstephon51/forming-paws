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
    .select('id, matched_at, dogA:dog_a_id(id, name), dogB:dog_b_id(id, name)')
    .order('matched_at', { ascending: false })

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
          const dogA = m.dogA as unknown as { id: string; name: string }
          const dogB = m.dogB as unknown as { id: string; name: string }
          const mine = myDogIds.has(dogA.id) ? dogA : dogB
          const theirs = myDogIds.has(dogA.id) ? dogB : dogA
          return (
            <li key={m.id} className="border p-4 rounded">
              <p className="font-medium">
                {mine.name} ↔ {theirs.name}
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
