import Link from 'next/link'
import SiteFooter from '@/components/SiteFooter'
import { pageMetadata } from '@/lib/seo'
import { SITE_NAME } from '@/lib/site'
import RecordLine from '@/components/record/RecordLine'
import Mark from '@/components/record/Mark'
import BannerArt from '@/components/art/BannerArt'
import neighbourhood from '@/assets/art/about-neighbourhood.jpg'
import { STEPS, FILE_FIELDS, MEETING, ROADMAP } from '@/lib/journey'

export const metadata = pageMetadata({
  title: 'About us',
  description:
    'Forming Paws is a Chicago nonprofit initiative raising the standard of dog breeding through veterinary verification, built on zero capital. What a health file contains, how review works, and exactly where the project actually is.',
  path: '/about',
})

/**
 * The long version: what this is, how it works, what we hold to, where we are
 * going, and — stated in the same notation as everything else — where we
 * actually are today.
 *
 * "The Open File" material lives here rather than on the landing page. The
 * front door is the illustrated worldflight; this is the page for someone who
 * has decided to look properly, which is why it can afford to be long and why
 * it is the right place to publish the project's own gaps.
 *
 * The sign-in panel and the waitlist form are deliberately NOT here. They are
 * landing-page functions, and a returning member should not have to read the
 * mission to find the login box.
 */

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

        {/* ---------- What a file contains ---------- */}
        <section aria-labelledby="file-h" id="file" className="mt-14 scroll-mt-24">
          <RecordLine label="Section 01" value="The record" className="mb-4" />
          <h2 id="file-h" className="fp-h2">
            What a file contains
          </h2>
          <p className="fp-lead mt-3">
            Every competitor asks to be trusted. This one shows you the file. Three documents,
            one status each, and the same three marks appear on every dog, every page and every
            claim on this site.
          </p>

          <ul className="fp-ledger mt-8">
            {FILE_FIELDS.map((field) => (
              <li key={field.label} className="fp-row">
                <RecordLine
                  status={field.status}
                  label={field.label}
                  value={field.value}
                  className="md:flex-nowrap md:whitespace-nowrap md:pt-1"
                />
                <p className="text-ink-soft">{field.note}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- How review works ---------- */}
        <section aria-labelledby="how-h" id="how" className="mt-14 scroll-mt-24">
          <RecordLine label="Section 02" value="The process" className="mb-4" />
          <h2 id="how-h" className="fp-h2">
            How it works, end to end
          </h2>
          <p className="fp-lead mt-3">
            Four steps from profile to a documented match. Numbered because the order matters:
            nothing unlocks out of sequence.
          </p>
          <ol className="mt-8">
            {STEPS.map((step) => (
              <li key={step.n} className="fp-row fp-rail">
                <span className="fp-meta text-ink">Step {step.n}</span>
                <div>
                  <h3 className="fp-h4">{step.title}</h3>
                  <p className="mt-2 text-ink-soft">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Meeting safely ---------- */}
        <section aria-labelledby="safety-h" id="safety" className="mt-14 scroll-mt-24">
          <RecordLine label="Section 03" value="Safety" className="mb-4" />
          <h2 id="safety-h" className="fp-h2">
            Meeting safely
          </h2>
          <p className="fp-lead mt-3">
            Health documentation is only half of it. The other half is that two strangers have to
            meet, and the platform should have an opinion about how.
          </p>
          <ul className="mt-6 rounded-xl bg-wash p-7">
            {MEETING.map((line) => (
              <li
                key={line}
                className="flex gap-3 border-t border-hairline py-3 first:border-t-0 first:pt-0 last:pb-0"
              >
                <Mark status="verified" label="" className="mt-[0.45rem]" />
                <span className="text-ink-soft">{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Principles ---------- */}
        <section aria-labelledby="principles" className="mt-14">
          <RecordLine label="Section 04" value="Principles" className="mb-4" />
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

        {/* ---------- Roadmap ---------- */}
        <section aria-labelledby="roadmap-h" id="roadmap" className="mt-14 scroll-mt-24">
          {/*
            One contained inversion: a moss band with ivory visible on all four
            sides, so it reads as a surface element rather than a background
            takeover.
          */}
          <div className="fp-band-deep">
            <RecordLine label="Section 05" value="Status" className="mb-4" />
            <h2 id="roadmap-h" className="fp-h2">
              Where we&apos;re headed
            </h2>
            <p className="fp-lead mt-3">
              What is live, what is underway, and what does not exist yet.
            </p>
            <ul className="mt-8">
              {ROADMAP.map((item) => (
                // key is title, not tag: two items legitimately share "Now".
                <li key={item.title} className="fp-row fp-rail border-brand/15">
                  <RecordLine
                    status={item.mark}
                    markLabel={item.markLabel}
                    label={item.tag}
                    className="md:pt-1"
                  />
                  <div>
                    <h3 className="fp-h5">{item.title}</h3>
                    <p className="mt-2 text-sm text-ink-soft">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Where we actually are ---------- */}
        <section aria-labelledby="structure" className="mt-14">
          <RecordLine label="Section 06" value="This project" className="mb-4" />
          <h2 id="structure" className="fp-h2">
            Where we actually are
          </h2>
          <div className="mt-4 flex flex-col gap-4 text-ink-soft">
            {/*
              Stated plainly and without inflation, in the same notation the
              site applies to every dog. This project is pre-approval, and an
              About page that implies otherwise is the kind of claim that is
              discovered at exactly the wrong moment — by a donor, a grantmaker,
              or a journalist.
            */}
            <div className="grid gap-x-8 gap-y-3 border-y border-hairline py-5 sm:grid-cols-2">
              <RecordLine status="none" label="501(c)(3) status" value="Not yet" />
              <RecordLine status="none" label="Paid staff" value="None" />
              <RecordLine status="none" label="Partner vets" value="None enrolled" />
              <RecordLine status="none" label="Outside capital" value="None raised" />
            </div>
            <p>
              {SITE_NAME} is being built as a nonprofit and is{' '}
              <strong>not yet an IRS-approved 501(c)(3)</strong>. We are pursuing that status and
              exploring fiscal sponsorship in the meantime. Nothing on this site is a
              tax-deductible donation solicitation, and we are not accepting donations yet.
            </p>
            <p>
              We are launching in Chicago, Illinois, on no outside capital. The platform is live
              and free. There is no paid staff.
            </p>
            <p>
              The vet partner network, the education hub, and the long-term goal of a supervised
              breeding and whelping facility are all ahead of us, not behind us. We would rather
              say that than describe a roadmap as if it had already happened.
            </p>
          </div>
        </section>

        <section aria-labelledby="help" className="fp-band mt-14">
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
