import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Thread from './Thread'
import ReportForm from './ReportForm'
import { markRead } from './actions'

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')
  const myOwnerId = userData.user.id

  // RLS returns nothing unless this owner is in the match, so a miss is a 404
  // rather than a permission message — we do not confirm the match exists.
  const { data: match } = await supabase
    .from('matches')
    .select('id, dog_a_id, dog_b_id, matched_at')
    .eq('id', matchId)
    .maybeSingle()
  if (!match) notFound()

  const { data: myDogs } = await supabase.from('dogs').select('id').eq('owner_id', myOwnerId)
  const myDogIds = new Set((myDogs ?? []).map((d) => d.id))

  // dogs_browsable, never an embedded select through dogs: dogs is owner-gated
  // and would silently return nothing for the other owner's dog.
  const { data: dogRows } = await supabase
    .from('dogs_browsable')
    .select('id, name')
    .in('id', [match.dog_a_id, match.dog_b_id])
  const nameById = new Map((dogRows ?? []).map((d) => [d.id, d.name]))

  const mineId = myDogIds.has(match.dog_a_id) ? match.dog_a_id : match.dog_b_id
  const theirsId = myDogIds.has(match.dog_a_id) ? match.dog_b_id : match.dog_a_id

  const { data: messages } = await supabase
    .from('messages')
    .select('id, body, sender_owner_id, created_at')
    .eq('match_id', matchId)
    .order('created_at')

  const { data: blocks } = await supabase
    .from('match_blocks')
    .select('blocker_owner_id')
    .eq('match_id', matchId)

  const blockedByMe = (blocks ?? []).some((b) => b.blocker_owner_id === myOwnerId)
  const blocked = (blocks ?? []).length > 0

  await markRead(matchId)

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {nameById.get(mineId) ?? 'Your dog'} ↔ {nameById.get(theirsId) ?? 'Their dog'}
        </h1>
        <Link href="/matches" className="text-sm text-gray-600 underline">
          All matches
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Meet in a public place. Forming Paws is not a party to any breeding arrangement.
      </p>

      <Thread
        matchId={matchId}
        myOwnerId={myOwnerId}
        theirDogName={nameById.get(theirsId) ?? 'Their dog'}
        initialMessages={messages ?? []}
        blocked={blocked}
        blockedByMe={blockedByMe}
      />

      <ReportForm matchId={matchId} />
    </main>
  )
}
