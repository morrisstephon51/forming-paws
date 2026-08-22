import Link from 'next/link'
import SiteFooter from '@/components/SiteFooter'
import { GUIDES } from '@/lib/education'
import { pageMetadata } from '@/lib/seo'
import BannerArt from '@/components/art/BannerArt'
import learnHub from '@/assets/art/learn-hub.jpg'

export const metadata = pageMetadata({
  title: 'Learn',
  description:
    'Practical guides for dog owners: what health documents you need, what to ask your vet, and how to meet another owner safely.',
  path: '/education',
})

export default function EducationPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-4">

      <main className="mt-8">
        <h1 className="fp-h1">
          <span aria-hidden="true">📚</span> Learn
        </h1>
        <p className="mt-4 text-ink-soft">
          Short, practical guides for owners thinking about breeding responsibly: what paperwork is
          needed, what to ask a professional, and how to handle the first meeting.
        </p>

        <BannerArt priority src={learnHub} className="mt-8" />

        {/*
          Prominent and near the top, not in a footer. Nothing here is written or
          reviewed by a veterinarian, and a member who mistakes it for medical
          guidance might act on it instead of booking an appointment.
        */}
        <p className="fp-card mt-6 border-l-4 border-l-accent text-sm text-ink-soft">
          <strong className="text-ink">These are not veterinary advice.</strong> They cover process
          and safety: paperwork, questions worth asking, meeting a stranger sensibly. Nothing here
          has been written or reviewed by a veterinarian, and none of it is a substitute for one.
        </p>

        <ul className="fp-depth mt-8 flex flex-col gap-4">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
              <Link
                href={`/education/${guide.slug}`}
                className="fp-card block transition-colors hover:border-brand/40"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-ink fp-h4">{guide.title}</h2>
                  <span className="fp-badge">{guide.readingMinutes} min read</span>
                </div>
                <p className="mt-2 text-sm text-ink-soft">{guide.summary}</p>
              </Link>
            </li>
          ))}
        </ul>

        <section aria-labelledby="more" className="fp-band mt-12">
          <h2 id="more" className="fp-h2">
            More is coming
          </h2>
          <p className="mt-2 text-ink-soft">
            This hub grows as the vet partner network does. Guides we can put a veterinarian&apos;s
            name to will say so. Until then we would rather publish three honest pages than thirty
            padded ones.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/vets" className="fp-btn-ghost">
              About the vet network
            </Link>
            <Link href="/contact" className="fp-btn-ghost">
              Suggest a topic
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
