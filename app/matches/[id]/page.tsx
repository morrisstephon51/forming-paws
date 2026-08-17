import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Thread from './Thread'
import ReportForm from './ReportForm'
import { markRead } from './actions'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Conversation',
  description: 'Talk with the other owner before you arrange anything in person.',
  path: '/matches/[id]',
  index: false,
})

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

  // An admin reading a reported conversation reaches this page without owning
  // either dog. They may read, but must not post, block, or report.
  const isParticipant = myDogIds.has(match.dog_a_id) || myDogIds.has(match.dog_b_id)

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

  if (isParticipant) await markRead(matchId)

  const dogA = nameById.get(match.dog_a_id) ?? 'A dog'
  const dogB = nameById.get(match.dog_b_id) ?? 'Another dog'

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {isParticipant
            ? `${nameById.get(mineId) ?? 'Your dog'} ↔ ${nameById.get(theirsId) ?? 'Their dog'}`
            : `${dogA} ↔ ${dogB}`}
        </h1>
        <Link
          href={isParticipant ? '/matches' : '/admin/reports'}
          className="text-sm text-ink-soft underline"
        >
          {isParticipant ? 'All matches' : 'Back to reports'}
        </Link>
      </div>

      {isParticipant ? (
        <p className="mt-1 text-sm text-ink-soft">
          Meet in a public place. Forming Paws is not a party to any breeding arrangement.
        </p>
      ) : (
        <p className="mt-1 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          You are reading this conversation because it was reported. Your access ends when the report
          is resolved or dismissed. You cannot post here.
        </p>
      )}

      <Thread
        matchId={matchId}
        myOwnerId={myOwnerId}
        theirDogName={isParticipant ? (nameById.get(theirsId) ?? 'Their dog') : dogA}
        initialMessages={messages ?? []}
        blocked={blocked}
        blockedByMe={blockedByMe}
        canParticipate={isParticipant}
      />

      {isParticipant && <ReportForm matchId={matchId} />}
    </main>
  )
}
