import Link from 'next/link'
import SiteFooter from '@/components/SiteFooter'
import { pageMetadata } from '@/lib/seo'
import { SITE_NAME } from '@/lib/site'
import RecordLine from '@/components/record/RecordLine'
import BannerArt from '@/components/art/BannerArt'
import neighbourhood from '@/assets/art/about-neighbourhood.jpg'

export const metadata = pageMetadata({
  title: 'About us',
  description:
    'Forming Paws is a Chicago nonprofit initiative raising the standard of dog breeding through veterinary verification, built on zero capital.',
  path: '/about',
})

const PRINCIPLES = [
  {
    title: 'Documentation before introduction',
    body: 'Matching stays locked until a vet exam and vaccinations are verified by a person. Not an honour system, not a checkbox. A reviewer reads every document.',
  },
  {
    title: 'A path, not a rejection',
    body: 'A dog whose records fall short is not turned away. The plan is to route those owners to partner veterinarians so their dog can reach the standard and come back.',
  },
  {
    title: 'Hostile to high-volume breeding',
    body: 'Litter caps per dog, age gates, mandatory documentation, and community reporting. The features that make this tedious for a puppy mill are the point.',
  },
  {
    title: 'Distance, never addresses',
    body: 'Owners see how far away a dog is. They never see where it lives until they choose to share that themselves.',
  },
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-4">

      <main className="mt-8">
        <RecordLine label="Nonprofit" value="Chicago" className="mb-4" />
        <h1 className="fp-h1">Why {SITE_NAME} exists</h1>

        <BannerArt priority src={neighbourhood} className="mt-8" />

        <div className="mt-6 flex flex-col gap-4 text-ink-soft">
          <p>
            Most dog breeding happens in a gap. On one side there are licensed, scrupulous
            breeders. On the other there are commercial operations nobody should buy from. In
            between sit ordinary owners with one healthy dog and good intentions, and almost
            nothing built for them.
          </p>
          <p>
            That gap is where preventable harm happens, not usually through cruelty, but through
            two people meeting on a classifieds site with no documentation, no health screening, and
            no idea what to ask each other.
          </p>
          <p>
            {SITE_NAME} is an attempt to put a floor under that. Verified health records before any
            introduction, safety guidance built into the product rather than buried in a policy, and
            a structure that gets steadily more annoying the closer you look like a puppy mill.
          </p>
        </div>

        <section aria-labelledby="principles" className="mt-12">
          <h2 id="principles" className="fp-h2">
            What we hold to
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="fp-card">
                <h3 className="text-ink fp-h5">{p.title}</h3>
                <p className="mt-2 text-sm text-ink-soft">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="structure" className="mt-12">
          <h2 id="structure" className="fp-h2">
            Where we actually are
          </h2>
          <div className="mt-4 flex flex-col gap-4 text-ink-soft">
            {/*
              Stated plainly and without inflation. This project is pre-approval,
              and an About page that implies otherwise is the kind of claim that
              is discovered at exactly the wrong moment — by a donor, or a
              grantmaker, or a journalist.
            */}
            {/*
              The same three marks used everywhere else on the site, applied to
              the site itself. A visitor is most likely to assume tax-deductible
              status in our favour if we say nothing, so we say something, in the
              notation they have already learned on the homepage.
            */}
            <div className="grid gap-x-8 gap-y-3 border-y border-hairline py-5 sm:grid-cols-2">
              <RecordLine status="none" label="501(c)(3) status" value="Not yet" />
              <RecordLine status="none" label="Paid staff" value="None" />
            </div>
            <p>
              {SITE_NAME} is being built as a nonprofit and is <strong>not yet an
              IRS-approved 501(c)(3)</strong>. We are pursuing that status and exploring fiscal
              sponsorship in the meantime. Nothing on this site is a tax-deductible donation
              solicitation, and we are not accepting donations yet.
            </p>
            <p>
              We are launching in Chicago, Illinois, on no outside capital. The platform is
              live and free. There is no paid staff.
            </p>
            <p>
              The vet partner network, the education hub, and the long-term goal of a supervised
              breeding and whelping facility are all ahead of us, not behind us. We would rather
              say that than describe a roadmap as if it had already happened.
            </p>
          </div>
        </section>

        <section aria-labelledby="help" className="fp-band mt-12">
          <h2 id="help" className="fp-h2">
            The most useful thing you can do
          </h2>
          <p className="mt-2 text-ink-soft">
            Join, list your dog, and get verified. A health-first platform is only worth anything
            once there are enough verified dogs on it for a good match to be findable.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/signup" className="fp-btn">
              Join free
            </Link>
            <Link href="/education" className="fp-btn-ghost">
              Read the guides
            </Link>
            <Link href="/contact" className="fp-btn-ghost">
              Ask us something
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
