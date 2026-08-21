import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sage from '@/components/mascot/Sage'
import SageNote from '@/components/mascot/SageNote'
import SiteFooter from '@/components/SiteFooter'
import LocationSettings from './LocationSettings'
import { dogListLabel } from '@/lib/dogs/dogLabel'
import { nextAction } from '@/lib/home/nextAction'
import { threadSummaries, totalUnread } from '@/lib/chat/threads'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Home',
  description: 'Your dogs, your matches, and what to do next.',
  path: '/home',
  index: false,
})

/**
 * Where a signed-in member lands.
 *
 * Replaces the old /dashboard, which listed dogs and nothing else — a member
 * with an unread message, a pending verification and no location had no screen
 * telling them which of those mattered. The single "next" prompt at the top is
 * the whole point of the page; everything below it is reference.
 */
export default async function HomePage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: owner } = await supabase
    .from('owners')
    .select('display_name, location_label, deactivated_at')
    .eq('id', userData.user.id)
    .single()

  const { data: dogs, error } = await supabase
    .from('dogs')
    .select('id, name, sex, birth_date, breeds(name)')
    .eq('owner_id', userData.user.id)

  // A member mid-deletion gets the one page that offers a way back, not the
  // product they just asked us to remove them from.
  if (owner?.deactivated_at) redirect('/account/reactivate')

  if (error) throw error

  const dogsWithStatus = await Promise.all(
    (dogs ?? []).map(async (dog) => {
      const { data: verified } = await supabase.rpc('dog_is_baseline_verified', {
        p_dog_id: dog.id,
      })
      return { ...dog, isVerified: !!verified }
    })
  )

  const unreadTotal = totalUnread(await threadSummaries(supabase))

  const action = nextAction({
    dogCount: dogsWithStatus.length,
    unverifiedDogs: dogsWithStatus.filter((d) => !d.isVerified).map((d) => ({ id: d.id, name: d.name })),
    hasLocation: Boolean(owner?.location_label),
    unreadCount: unreadTotal,
  })

  return (
    <div className="mx-auto max-w-3xl px-6 py-4">

      <main className="mt-8">
        <h1 className="flex items-center gap-3 fp-h1">
          <Sage mood="waving" size={56} />
          Welcome back
          {owner?.display_name ? `, ${owner.display_name}` : ''}
        </h1>

        <section aria-labelledby="next-up" className="fp-band mt-6">
          <h2 id="next-up" className="text-xs font-bold uppercase tracking-wide text-brand-dark">
            Next up
          </h2>
          <p className="mt-2 font-display text-xl font-bold text-ink">{action.label}</p>
          <p className="mt-1 text-sm text-ink-soft">{action.body}</p>
          <Link href={action.href} className="fp-btn mt-4">
            {action.kind === 'browse' ? 'Start browsing' : 'Take me there'}
          </Link>
        </section>

        <section aria-labelledby="your-dogs" className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="your-dogs" className="text-2xl font-bold">
              Your dogs
            </h2>
            <Link href="/dogs/new" className="fp-btn-ghost px-4 py-2 text-sm">
              Add a dog
            </Link>
          </div>

          <ul className="mt-4 flex flex-col gap-3">
            {dogsWithStatus.map((dog) => (
              <li key={dog.id}>
                <Link
                  href={`/dogs/${dog.id}`}
                  className="fp-card block transition-colors hover:border-brand/40"
                >
                  {dogListLabel(dog.name, dog.sex, dog.isVerified)}
                </Link>
              </li>
            ))}
          </ul>

          {dogsWithStatus.length === 0 && (
            <SageNote mood="thinking" title="No dogs yet" size={76}>
              Add your first dog to start matching — it takes a few minutes, and health
              verification begins as soon as the records are in.
            </SageNote>
          )}
        </section>

        <section aria-labelledby="your-location" className="mt-10">
          <h2 id="your-location" className="text-2xl font-bold">
            Your location
          </h2>
          <LocationSettings currentLabel={owner?.location_label ?? null} />
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
