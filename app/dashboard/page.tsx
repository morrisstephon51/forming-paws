import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LocationSettings from './LocationSettings'
import { dogListLabel } from './dogLabel'
import { threadSummaries, totalUnread } from '@/lib/chat/threads'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Your dogs',
  description: 'Your dog profiles, health verification status and unread messages.',
  path: '/dashboard',
  index: false,
})

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: owner } = await supabase
    .from('owners')
    .select('location_label')
    .eq('id', userData.user.id)
    .single()

  const { data: dogs, error } = await supabase
    .from('dogs')
    .select('id, name, sex, birth_date, breeds(name)')
    .eq('owner_id', userData.user.id)

  if (error) throw error

  // The static site's dashboard showed a status pill on every dog. This page is
  // replacing it, so it has to carry that information or the move is a downgrade.
  const dogsWithStatus = await Promise.all(
    (dogs ?? []).map(async (dog) => {
      const { data: verified } = await supabase.rpc('dog_is_baseline_verified', {
        p_dog_id: dog.id,
      })
      return { ...dog, isVerified: !!verified }
    })
  )

  // The matches page is not where members land, so the unread count has to
  // surface here or nobody discovers a new message.
  const unreadTotal = totalUnread(await threadSummaries(supabase))

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your dogs</h1>
        <div className="flex gap-3 items-center">
          <Link href="/browse" className="text-sm underline text-gray-600">
            Browse
          </Link>
          <Link href="/matches" className="text-sm underline text-gray-600">
            Matches
            {unreadTotal > 0 && (
              <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold text-white no-underline">
                {unreadTotal}
              </span>
            )}
          </Link>
          <Link href="/account/password" className="text-sm underline text-gray-600 hover:text-brand">
            Account
          </Link>
          <Link href="/dogs/new" className="bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded">
            Add a dog
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm underline text-gray-600 hover:text-brand">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <LocationSettings currentLabel={owner?.location_label ?? null} />
      <ul className="mt-6 flex flex-col gap-3">
        {dogsWithStatus.map((dog) => (
          <li key={dog.id}>
            <Link href={`/dogs/${dog.id}`} className="block border p-4 rounded hover:bg-gray-50">
              {dogListLabel(dog.name, dog.sex, dog.isVerified)}
            </Link>
          </li>
        ))}
        {dogsWithStatus.length === 0 && <p className="text-gray-500">No dogs yet.</p>}
      </ul>
    </main>
  )
}
