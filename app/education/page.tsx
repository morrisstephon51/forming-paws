import Link from 'next/link'
import SiteFooter from '@/components/SiteFooter'
import { GUIDES } from '@/lib/education'
import RecordLine from '@/components/record/RecordLine'
import { pageMetadata } from '@/lib/seo'
import BannerArt from '@/components/art/BannerArt'
import learnHub from '@/assets/art/learn-hub.jpg'

export const metadata = pageMetadata({
  title: 'Learn',
  description:
    'Practical guides for dog owners: health documents, Illinois law, written agreements, choosing a trainer, behaviour help, year-round care, and meeting another owner safely.',
  path: '/education',
})

/** The claim each guide is not making, by notice type. */
const REVIEW_LABEL = { vet: 'Vet-reviewed', legal: 'Lawyer-reviewed' } as const

export default function EducationPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-4">

      <main className="mt-8">
        <RecordLine label="Catalogue" value="Guides" className="mb-4" />
        <h1 className="fp-h1">Learn</h1>
        <p className="mt-4 text-ink-soft">
          Short, practical guides for owners thinking about breeding responsibly: the paperwork,
          the law as published, what to put in writing, how to pick a trainer or a behaviour
          professional, and the ordinary care a year asks for.
        </p>

        <BannerArt priority src={learnHub} className="mt-8" />

        {/*
          Prominent and near the top, not in a footer. Nothing here is written or
          reviewed by a veterinarian, and a member who mistakes it for medical
          guidance might act on it instead of booking an appointment.
        */}
        <div className="mt-6 border-y border-hairline py-5">
          <RecordLine status="none" label="Vet-reviewed" value="Not yet" />
          <RecordLine status="none" label="Lawyer-reviewed" value="Not yet" className="mt-2" />
          <p className="mt-3 max-w-[46rem] text-sm text-ink-soft">
            <strong className="text-ink">These are not veterinary or legal advice.</strong> They
            cover process, safety, and the published rules: paperwork, questions worth asking, what
            a statute says and where to read it. Nothing here has been written or reviewed by a
            veterinarian or a lawyer, and none of it substitutes for either. Every page that states
            a rule links the document it came from.
          </p>
        </div>

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
                {/*
                  Repeated per guide on purpose. One disclaimer at the top of a
                  list is read once and then forgotten by the third card; the
                  mark travels with the thing it qualifies.
                */}
                <RecordLine
                  status="none"
                  label={REVIEW_LABEL[guide.notice]}
                  value="Not yet"
                  className="mt-3"
                />
              </Link>
            </li>
          ))}
        </ul>

        <section aria-labelledby="more" className="fp-band mt-12">
          <h2 id="more" className="fp-h2">
            More is coming
          </h2>
          <p className="mt-2 text-ink-soft">
            This hub grows whenever something is worth writing down, and it will grow faster once
            the vet partner network exists. Guides we can put a veterinarian&apos;s name to will say
            so. Until then we would rather publish a few honest pages than thirty padded ones.
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
