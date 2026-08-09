import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LocationSettings from './LocationSettings'
import { dogListLabel } from './dogLabel'

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
          </Link>
          <Link href="/dogs/new" className="bg-gray-900 text-white px-4 py-2 rounded">
            Add a dog
          </Link>
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
