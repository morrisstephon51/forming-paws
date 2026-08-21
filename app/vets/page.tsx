import Link from 'next/link'
import SiteFooter from '@/components/SiteFooter'
import { pageMetadata } from '@/lib/seo'
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site'
import { RESPONSE_TIME } from '@/lib/promise'

export const metadata = pageMetadata({
  title: 'Vet partners',
  description:
    'The veterinary referral network Forming Paws is building — what it is for, what we are looking for in a partner, and how to get involved.',
  path: '/vets',
})

const LOOKING_FOR = [
  {
    title: 'Chicago-area practices',
    body: 'We are launching in one city and would rather serve it properly than spread thin across a map.',
  },
  {
    title: 'Willing to see under-documented dogs',
    body: 'The whole point is owners whose dogs cannot currently reach the baseline. That is the referral, and it is the hard part.',
  },
  {
    title: 'Transparent about cost',
    body: 'Owners need to know what an exam will cost before they book. A reduced or fixed rate for referred owners is what makes the pathway real rather than theoretical.',
  },
  {
    title: 'Comfortable being named',
    body: 'A directory only helps if owners can see who is in it. Partners are listed publicly, with their consent.',
  },
]

export default function VetsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-4">

      <main className="mt-8">
        <h1 className="fp-h1">
          <span aria-hidden="true">🩺</span> Vet partners
        </h1>

        {/*
          The honest state, first and unmissable. A directory page that implies
          partners exist would send owners looking for a clinic that isn't there —
          and the first thing a real vet would notice is that we listed nobody
          they recognise.
        */}
        <div className="fp-card mt-6 border-l-4 border-l-accent">
          <p className="font-semibold text-ink">
            We do not have partner veterinarians yet.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            This page describes what we are building, not something you can use today. There is no
            directory below because there is nobody in it. When there is, this page becomes the
            list.
          </p>
        </div>

        <section aria-labelledby="why" className="mt-12">
          <h2 id="why" className="text-2xl font-bold">
            What the network is for
          </h2>
          <div className="mt-4 flex flex-col gap-4 text-ink-soft">
            <p>
              {SITE_NAME} locks matching until a dog&apos;s health documents are verified. That
              gate does its job — but it also creates a group of owners whose dogs are simply
              behind on care, often for reasons of cost rather than neglect.
            </p>
            <p>
              Turning those owners away accomplishes nothing. The dog stays under-documented, the
              owner goes to a classifieds site with no standards at all, and we have made things
              slightly worse while feeling principled about it.
            </p>
            <p>
              The referral network is the alternative: a route from &ldquo;your dog does not
              qualify&rdquo; to &ldquo;here is how your dog can qualify, affordably&rdquo;.
            </p>
          </div>
        </section>

        <section aria-labelledby="looking" className="mt-12">
          <h2 id="looking" className="text-2xl font-bold">
            What we are looking for
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {LOOKING_FOR.map((item) => (
              <div key={item.title} className="fp-card">
                <h3 className="text-ink fp-h5">{item.title}</h3>
                <p className="mt-2 text-sm text-ink-soft">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="vets-contact" className="fp-band mt-12">
          <h2 id="vets-contact" className="text-2xl font-bold">
            If you are a veterinarian
          </h2>
          <p className="mt-2 text-ink-soft">
            We would genuinely like to hear from you — including if you think this is a bad idea, or
            that the baseline we ask for is wrong. That feedback is worth more to us right now than
            a signup. {RESPONSE_TIME.sentence}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/contact" className="fp-btn">
              Get in touch
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="fp-btn-ghost">
              {CONTACT_EMAIL}
            </a>
          </div>
        </section>

        <section aria-labelledby="owners" className="mt-12">
          <h2 id="owners" className="text-2xl font-bold">
            If you are an owner whose dog did not pass
          </h2>
          <p className="mt-4 text-ink-soft">
            Until the network exists, the honest advice is the ordinary kind: book a wellness exam
            with any local practice, ask for the exam summary and vaccination history as separate
            documents, and upload them. Most documents that fail review fail on a date, not on a
            diagnosis.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/education/health-documents" className="fp-btn-ghost">
              What documents you need
            </Link>
            <Link href="/education/questions-for-your-vet" className="fp-btn-ghost">
              Questions to ask your vet
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
