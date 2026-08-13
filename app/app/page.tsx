import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
import ShareButtons from '@/components/ShareButtons'
import SiteFooter from '@/components/SiteFooter'
import StickyJoinBar from '@/components/StickyJoinBar'
import { absoluteUrl, pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'See the app',
  description:
    'A look inside Forming Paws before you sign up: verified health badges, distance-only browsing, and chat that unlocks only on a mutual match.',
  path: '/app',
})

/**
 * Replaces the static `app.html` demo carried over from the GitHub Pages site.
 *
 * Every dog below is invented, and says so loudly. The old page showed seeded
 * profiles in a layout close enough to the real thing that a visitor could
 * reasonably have believed they were looking at real dogs available near them.
 */
const SAMPLE_DOGS = [
  {
    name: 'Juno',
    breed: 'Labrador Retriever',
    age: '3 years',
    sex: 'Female',
    distance: '4 miles away',
    verified: true,
  },
  {
    name: 'Bear',
    breed: 'Bernese Mountain Dog',
    age: '2 years',
    sex: 'Male',
    distance: '7 miles away',
    verified: true,
  },
  {
    name: 'Sable',
    breed: 'German Shepherd',
    age: '4 years',
    sex: 'Female',
    distance: '11 miles away',
    verified: false,
  },
]

const TOUR = [
  {
    title: 'A profile per dog, not per owner',
    body: 'Breed, age, sex, temperament and photos live on the dog. One account can hold several dogs, each with its own health record and its own matches.',
  },
  {
    title: 'Health verification you can see',
    body: 'Vet records go into a private vault that only you and our reviewers can open. Once the baseline is checked by a person, the dog carries a green verified badge. Until then, matching stays locked.',
  },
  {
    title: 'Distance, never addresses',
    body: 'Browsing shows roughly how far away a dog is. Your exact location is never shown to another member, and you can browse without sharing a location at all.',
  },
  {
    title: 'Chat only after a mutual match',
    body: 'Express interest in a dog. If that owner does the same, a conversation opens for both of you. Nobody can message you out of the blue, and either owner can close the thread or report it at any time.',
  },
]

export default function AppTourPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 pb-28 sm:pb-10">
      <Breadcrumbs trail={[{ label: 'See the app' }]} />

      <h1 className="mt-6 text-3xl font-bold">What you get after you join</h1>
      <p className="mt-4 text-gray-600">
        Forming Paws is a working web app, not a waiting list. This is what it does — and the four
        rules that shape all of it.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/signup" className="rounded bg-gray-900 px-5 py-2 font-semibold text-white">
          Join free
        </Link>
        <Link href="/faq" className="rounded border px-5 py-2 font-semibold">
          Read the FAQ
        </Link>
      </div>

      <section className="mt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-bold">Browsing looks like this</h2>
          <p className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
            Example dogs — not real listings
          </p>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          The three below are invented to show the layout. Real dogs appear only after you sign in,
          and only within the distance you choose.
        </p>

        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {SAMPLE_DOGS.map((dog) => (
            <li key={dog.name} className="rounded-lg border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{dog.name}</h3>
                {dog.verified ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                    ✓ Verified
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                    Pending
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-600">{dog.breed}</p>
              <p className="text-sm text-gray-600">
                {dog.sex} · {dog.age}
              </p>
              <p className="mt-2 text-sm text-gray-500">📍 {dog.distance}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold">The four rules behind it</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {TOUR.map((item) => (
            <div key={item.title} className="rounded-lg border p-5">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-lg border bg-gray-50 p-6">
        <h2 className="text-xl font-bold">Set your dog up in a few minutes</h2>
        <p className="mt-2 text-sm text-gray-600">
          Joining is free. You can create the profile now and upload vet records whenever you have
          them to hand.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/signup" className="rounded bg-gray-900 px-5 py-2 font-semibold text-white">
            Create your account
          </Link>
          <Link href="/contact" className="rounded border px-5 py-2 font-semibold">
            Ask us something first
          </Link>
        </div>
      </section>

      <div className="mt-10">
        <ShareButtons
          url={absoluteUrl('/app')}
          title="Forming Paws — health-verified breeding matches for dog owners"
        />
      </div>

      <SiteFooter />
      <StickyJoinBar />
    </div>
  )
}
