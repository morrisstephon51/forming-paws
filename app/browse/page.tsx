import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getBreeds } from '@/lib/breeds'
import { getThumbnailUrl } from '@/lib/dogPhotos'
import { ageInYears } from '@/lib/age'
import LocationPrompt from './LocationPrompt'
import SiteHeader from '@/components/SiteHeader'
import { threadSummaries, totalUnread } from '@/lib/chat/threads'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Browse dogs near you',
  description: 'Filter health-verified dogs by breed, sex, age and distance, and express interest in a match.',
  path: '/browse',
  index: false,
})


const VALID_SEXES = ['male', 'female']

type BrowseDogRow = {
  id: string
  name: string
  breed_name: string
  sex: 'male' | 'female'
  birth_date: string
  owner_id: string
  location_label: string | null
  distance_miles: number | null
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{
    breedId?: string
    sex?: string
    verifiedOnly?: string
    minAge?: string
    maxAge?: string
    radiusMiles?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: me } = await supabase
    .from('owners')
    .select('location_label, deactivated_at')
    .eq('id', userData.user.id)
    .single()
  if (me?.deactivated_at) redirect('/account/reactivate')

  const hasLocation = !!me?.location_label

  // The header badge has to be true on every page that shows it, so this page
  // pays for one extra RPC rather than rendering a silently stale zero.
  const unreadTotal = totalUnread(await threadSummaries(supabase))

  const breeds = await getBreeds()

  const { data: dogs, error } = await supabase.rpc('browse_dogs', {
    p_breed_id: params.breedId ? Number(params.breedId) : null,
    p_sex: VALID_SEXES.includes(params.sex ?? '') ? params.sex : null,
    p_verified_only: params.verifiedOnly === 'true',
    p_min_age_years: params.minAge ? Number(params.minAge) : null,
    p_max_age_years: params.maxAge ? Number(params.maxAge) : null,
    p_radius_miles: params.radiusMiles ? Number(params.radiusMiles) : null,
  })

  if (error) throw error

  const dogsWithPhotos = await Promise.all(
    (dogs ?? []).map(async (dog: BrowseDogRow) => ({
      ...dog,
      photoUrl: await getThumbnailUrl(supabase, dog.id),
    }))
  )

  return (
    <div className="mx-auto max-w-2xl px-6 py-4">
      <SiteHeader variant="member" pathname="/browse" unreadCount={unreadTotal} />
      <main className="mt-6">
      <h1 className="text-2xl font-bold">Browse dogs</h1>

      {!hasLocation && <LocationPrompt />}

      <form method="get" className="mt-6 flex flex-wrap gap-2">
        <select name="breedId" defaultValue={params.breedId ?? ''} className="border p-2 text-sm">
          <option value="">Any breed</option>
          {breeds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="sex" defaultValue={params.sex ?? ''} className="border p-2 text-sm">
          <option value="">Any sex</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <input
          name="minAge"
          type="number"
          placeholder="Min age"
          defaultValue={params.minAge ?? ''}
          className="border p-2 text-sm w-24"
        />
        <input
          name="maxAge"
          type="number"
          placeholder="Max age"
          defaultValue={params.maxAge ?? ''}
          className="border p-2 text-sm w-24"
        />
        <input
          name="radiusMiles"
          type="number"
          placeholder="Radius (mi)"
          defaultValue={params.radiusMiles ?? ''}
          className="border p-2 text-sm w-28"
        />
        <label className="flex items-center gap-1 text-sm">
          <input
            name="verifiedOnly"
            type="checkbox"
            value="true"
            defaultChecked={params.verifiedOnly === 'true'}
          />
          Verified only
        </label>
        <button type="submit" className="bg-brand text-white px-3 py-1 rounded text-sm">
          Filter
        </button>
      </form>

      <ul className="mt-6 flex flex-col gap-3">
        {dogsWithPhotos.map((dog) => (
          <li key={dog.id}>
            <Link href={`/dogs/${dog.id}`} className="flex gap-3 border p-3 rounded hover:bg-brand-soft">
              {dog.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dog.photoUrl} alt={dog.name} className="h-16 w-16 rounded object-cover" />
              ) : (
                <div className="h-16 w-16 rounded bg-brand-soft" />
              )}
              <div>
                <p className="font-medium">
                  {dog.name} — {dog.breed_name}, {ageInYears(dog.birth_date)}yo {dog.sex}
                </p>
                {dog.distance_miles != null && (
                  <p className="text-sm text-ink-soft">
                    {Math.round(dog.distance_miles)} mi away
                    {dog.location_label ? ` · ${dog.location_label}` : ''}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
        {dogsWithPhotos.length === 0 && <p className="text-ink-soft">No dogs match your filters.</p>}
      </ul>
      </main>
    </div>
  )
}
