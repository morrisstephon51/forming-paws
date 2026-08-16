import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { threadSummaries } from '@/lib/chat/threads'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Your matches',
  description: 'Every owner whose dog matched with yours, and the conversations you have open with them.',
  path: '/matches',
  index: false,
})

export default async function MatchesPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')
  const myOwnerId = userData.user.id

  const { data: myDogs } = await supabase.from('dogs').select('id').eq('owner_id', myOwnerId)
  const myDogIds = new Set((myDogs ?? []).map((d) => d.id))

  const { data: matches } = await supabase
    .from('matches')
    .select('id, matched_at, dog_a_id, dog_b_id')
    .order('matched_at', { ascending: false })

  const involvedDogIds = Array.from(
    new Set((matches ?? []).flatMap((m) => [m.dog_a_id, m.dog_b_id]))
  )
  // dogs_browsable, never an embedded select through dogs — dogs is owner-gated.
  const { data: dogRows } = involvedDogIds.length
    ? await supabase.from('dogs_browsable').select('id, name').in('id', involvedDogIds)
    : { data: [] }
  const nameById = new Map((dogRows ?? []).map((d) => [d.id, d.name]))

  // Counted and previewed in Postgres — see lib/chat/threads.ts for why this is
  // not a message pull any more.
  const threads = await threadSummaries(supabase)
  const unread = new Map(threads.map((t) => [t.match_id, t.unread]))
  const lastByMatch = new Map(threads.map((t) => [t.match_id, t.last_body]))

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your matches</h1>
        <Link href="/dashboard" className="text-sm text-gray-600 underline">
          Back to dashboard
        </Link>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        Matches are introductions only — Forming Paws is not a party to any breeding arrangement.
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {matches?.map((m) => {
          const mineId = myDogIds.has(m.dog_a_id) ? m.dog_a_id : m.dog_b_id
          const theirsId = myDogIds.has(m.dog_a_id) ? m.dog_b_id : m.dog_a_id
          const count = unread.get(m.id) ?? 0
          const preview = lastByMatch.get(m.id)
          return (
            <li key={m.id}>
              <Link href={`/matches/${m.id}`} className="block rounded border p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">
                    {nameById.get(mineId) ?? 'Your dog'} ↔ {nameById.get(theirsId) ?? 'Their dog'}
                  </p>
                  {count > 0 && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                      {count}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-gray-500">
                  {preview ?? `Matched ${new Date(m.matched_at).toLocaleDateString()}`}
                </p>
              </Link>
            </li>
          )
        })}
        {matches?.length === 0 && <p className="text-gray-500">No matches yet.</p>}
      </ul>
    </main>
  )
}
