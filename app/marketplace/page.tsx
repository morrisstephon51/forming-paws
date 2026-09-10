import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getBreeds } from '@/lib/breeds'
import { getThumbnailUrl } from '@/lib/dogPhotos'
import { ageInYears } from '@/lib/age'
import { formatCalendarDate } from '@/lib/dates'
import { pageMetadata } from '@/lib/seo'
import SageNote from '@/components/mascot/SageNote'

export const metadata = pageMetadata({
  title: 'Puppy marketplace',
  description: 'Browse verified litters near you. Inquiries happen in-app; no payment moves through Forming Paws.',
  path: '/marketplace',
  index: false,
})

type PuppyRow = {
  id: string
  name: string
  breed_name: string
  sex: 'male' | 'female'
  birth_date: string
  listed_price_cents: number | null
  ready_on: string | null
  owner_id: string
  location_label: string | null
  distance_miles: number | null
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ breedId?: string; radiusMiles?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const breeds = await getBreeds()

  const { data: puppies, error } = await supabase.rpc('browse_puppies', {
    p_breed_id: params.breedId ? Number(params.breedId) : null,
    p_radius_miles: params.radiusMiles ? Number(params.radiusMiles) : null,
  })

  if (error) throw error

  const puppiesWithPhotos = await Promise.all(
    (puppies ?? []).map(async (puppy: PuppyRow) => ({
      ...puppy,
      photoUrl: await getThumbnailUrl(supabase, puppy.id),
    }))
  )

  return (
    <div className="mx-auto max-w-2xl px-6 py-4">
      <main className="mt-6">
        <h1 className="fp-h2">Puppy marketplace</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every litter here comes from two health-verified parent dogs. Reach out in-app; Forming
          Paws never processes payment for a puppy.
        </p>

        <form method="get" className="mt-6 flex flex-wrap gap-2">
          <select name="breedId" defaultValue={params.breedId ?? ''} className="fp-input w-auto text-sm">
            <option value="">Any breed</option>
            {breeds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            name="radiusMiles"
            type="number"
            placeholder="Radius (mi)"
            defaultValue={params.radiusMiles ?? ''}
            className="fp-input text-sm w-28"
          />
          <button type="submit" className="fp-btn px-4 py-1.5 text-sm">
            Filter
          </button>
        </form>

        <ul className="fp-depth mt-6 flex flex-col gap-3">
          {puppiesWithPhotos.map((puppy) => (
            <li key={puppy.id}>
              <Link
                href={`/dogs/${puppy.id}`}
                className="flex gap-3 rounded-xl border border-hairline p-3 hover:bg-brand-soft"
              >
                {puppy.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={puppy.photoUrl} alt={puppy.name} className="h-16 w-16 rounded object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-brand-soft" />
                )}
                <div>
                  <p className="font-medium">
                    {puppy.name} · {puppy.breed_name}, {ageInYears(puppy.birth_date)}yo {puppy.sex}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {puppy.listed_price_cents != null
                      ? `$${(puppy.listed_price_cents / 100).toLocaleString()}`
                      : 'Price on inquiry'}
                    {puppy.ready_on ? ` · ready ${formatCalendarDate(puppy.ready_on)}` : ''}
                  </p>
                  {puppy.distance_miles != null && (
                    <p className="text-sm text-ink-soft">
                      {Math.round(puppy.distance_miles)} mi away
                      {puppy.location_label ? ` · ${puppy.location_label}` : ''}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
          {puppiesWithPhotos.length === 0 && (
            <li>
              <SageNote mood="thinking" title="No puppies listed yet">
                Litters appear here once a breeder health-verifies both parent dogs and lists their
                puppies.
              </SageNote>
            </li>
          )}
        </ul>
      </main>
    </div>
  )
}
