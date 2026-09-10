import { pageMetadata } from '@/lib/seo'
import SiteFooter from '@/components/SiteFooter'
import Link from 'next/link'
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED, SITE_NAME } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Terms of Service',
  description: `The terms you agree to when using ${SITE_NAME}.`,
  path: '/terms',
})

export default function TermsPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-ink-soft underline">
        ← Back to {SITE_NAME}
      </Link>

      <h1 className="mt-6 fp-h1">Terms of Service</h1>
      <p className="mt-2 text-sm text-ink-soft">Last updated {LEGAL_LAST_UPDATED}</p>

      <div className="mt-8 flex flex-col gap-6 text-ink-soft">
        <section>
          <h2 className="text-ink fp-h4">What {SITE_NAME} is</h2>
          <p className="mt-3">
            {SITE_NAME} is a platform that helps dog owners find each other and review health
            documentation before deciding whether to breed. We provide introductions and a review
            process.{' '}
            <strong>
              We are not a party to any breeding arrangement between owners, and we do not broker,
              supervise, or guarantee anything that happens between you.
            </strong>
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Who can use it</h2>
          <p className="mt-3">
            You must be at least 18 and legally able to enter into agreements. You are responsible
            for keeping your password secure and for everything done through your account.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">
            What health verification does and does not mean
          </h2>
          <p className="mt-3">
            Our reviewers check that the veterinary documents you upload appear genuine, current, and
            cover the required baseline. That is a <strong>document review</strong>.
          </p>
          <p className="mt-3">
            It is <strong>not</strong> a veterinary examination, a diagnosis, a genetic guarantee, or
            a promise about any dog&apos;s health, temperament, fertility, or offspring. A verified
            badge means paperwork was checked, nothing more.{' '}
            <strong>
              Always consult your own veterinarian before breeding, and have any dog you are
              considering examined independently.
            </strong>
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Your responsibilities</h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-6">
            <li>Give accurate information about yourself and your dog.</li>
            <li>
              Upload only genuine veterinary documents that relate to the dog you are listing.
              Falsifying records is grounds for immediate and permanent removal.
            </li>
            <li>Meet other owners in safe, public places, and use your own judgement.</li>
            <li>Comply with the animal welfare, licensing, and breeding laws where you live.</li>
            <li>Treat other members decently.</li>
            <li>
              Keep messages civil. Reporting a conversation lets a reviewer read it while they look
              into the report.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-ink fp-h4">What you may not do</h2>
          <p className="mt-3">
            You may not use {SITE_NAME} to operate a high-volume commercial breeding business, list
            dogs you do not own, misrepresent a dog&apos;s health or history, harass other members,
            or scrape or resell platform data. We enforce limits on how often a dog can be listed for
            breeding, and we act on member reports.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Your content</h2>
          <p className="mt-3">
            Your photos and profile text remain yours. You give us permission to display them within
            the platform so other members can see your listing. You can remove them by deleting the
            listing or your account.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">No warranty, and limits on liability</h2>
          <p className="mt-3">
            The service is provided as-is. We do not warrant that it will be uninterrupted or
            error-free, and we make no guarantee about any member, any dog, or any outcome of a
            breeding arrangement.
          </p>
          <p className="mt-3">
            To the fullest extent the law allows, {SITE_NAME} is not liable for indirect or
            consequential losses arising from your use of the platform, from dealings with other
            members, or from any breeding outcome. Nothing here limits liability that cannot legally
            be limited.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Ending your account</h2>
          <p className="mt-3">
            You can delete your account at any time by emailing us. We may suspend or remove accounts
            that break these terms, falsify documents, or put animals or members at risk.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Changes</h2>
          <p className="mt-3">
            We may update these terms as the platform grows. Substantive changes will be announced to
            members by email, and the date above will change.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Contact</h2>
          <p className="mt-3">
            Questions go to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <p className="border-t pt-6 text-sm text-ink-soft">
          See also our{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
      <SiteFooter />
    </>
  )
}
