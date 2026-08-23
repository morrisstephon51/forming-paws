import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED, SITE_NAME } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Privacy Policy',
  description: `How ${SITE_NAME} collects, uses, and protects your information.`,
  path: '/privacy',
})

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-ink-soft underline">
        ← Back to {SITE_NAME}
      </Link>

      <h1 className="mt-6 fp-h1">Privacy Policy</h1>
      <p className="mt-2 text-sm text-ink-soft">Last updated {LEGAL_LAST_UPDATED}</p>

      <div className="mt-8 flex flex-col gap-6 text-ink-soft">
        <p>
          {SITE_NAME} is an early-stage nonprofit initiative connecting dog owners for
          health-documented breeding matches. This policy explains exactly what we collect, why, and
          what you can ask us to do with it. We have tried to describe our actual system rather than
          write around it.
        </p>

        <section>
          <h2 className="text-ink fp-h4">What we collect</h2>
          <p className="mt-3">When you create an account and a dog profile, we store:</p>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-6">
            <li>
              <strong>About you:</strong> your display name, email address, and a city or
              neighbourhood label you type in. Your password is handled by our authentication
              provider and is never visible to us.
            </li>
            <li>
              <strong>Your location, if you share it:</strong> if you use the &ldquo;share my
              location&rdquo; feature, we store the coordinates your browser reports. We use them
              only to calculate distance. Other members are shown{' '}
              <strong>an approximate distance in miles</strong>, never your coordinates, address, or
              map position.
            </li>
            <li>
              <strong>About your dog:</strong> name, breed, sex, birth date, weight, and any
              temperament notes you write.
            </li>
            <li>
              <strong>Photos</strong> you upload of your dog.
            </li>
            <li>
              <strong>Veterinary documents</strong> you upload, along with the document type and
              date, so a reviewer can verify them.
            </li>
            <li>
              <strong>Your activity on the platform:</strong> which dogs you express interest in, and
              the resulting matches.
            </li>
            <li>
              <strong>Messages</strong> you send to another owner after a mutual match.
            </li>
            <li>
              <strong>Waitlist entries:</strong> if you join the waitlist without creating an
              account, we store the email, city, and breed you provide.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-ink fp-h4">What we do not collect</h2>
          <p className="mt-3">
            We do not run advertising trackers or third-party analytics. We do not collect your
            precise street address. We do not buy data about you from anyone, and{' '}
            <strong>we do not sell or rent your information</strong>. The only cookies we set are the
            ones that keep you signed in.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Who can see what</h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-6">
            <li>
              <strong>Other signed-in members</strong> can see your dog&apos;s profile, photos,
              whether it is health-verified, and roughly how far away it is.
            </li>
            <li>
              <strong>Your veterinary documents are private.</strong> Other members never see them,
              only whether verification passed.
            </li>
            <li>
              <strong>Our reviewers</strong> can see veterinary documents in order to verify them,
              and can see the member roster. This access is limited to accounts we mark as
              administrators.
            </li>
            <li>
              <strong>Nobody browsing anonymously</strong> can see member or dog data. You must be
              signed in.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Your messages</h2>
          <p className="mt-3">
            Messages between two owners are private to those two people. Our staff{' '}
            <strong>cannot</strong> read them.
          </p>
          <p className="mt-3">
            There is one exception. If either owner reports a conversation, a reviewer can read that
            conversation while they look into the report, so that we can act on harassment, welfare
            concerns, or falsified documents. <strong>That access ends</strong> when the report is
            resolved or dismissed. This limit is enforced by our database, not by staff discipline.
          </p>
          <p className="mt-3">
            Individual messages cannot be edited or deleted. That is deliberate: a reported
            conversation must not be alterable after the fact. All of your messages are removed when
            your account is deleted.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Who processes it for us</h2>
          <p className="mt-3">
            We use <strong>Supabase</strong> for our database, sign-in, and file storage, and{' '}
            <strong>Vercel</strong> for hosting. They process data on our behalf in order to run the
            service. We do not share your information with anyone else except where the law requires
            it.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">How long we keep it</h2>
          <p className="mt-3">
            We keep your account and dog profiles for as long as your account exists. If you ask us
            to delete your account, we remove your profile, dogs, photos, and veterinary documents.
            Waitlist entries are kept until we launch in your area or you ask us to remove yours.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Your choices</h2>
          <p className="mt-3">
            You can ask us to show you what we hold about you, correct it, delete it, or send you a
            copy. Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {CONTACT_EMAIL}
            </a>{' '}
            and we will respond within 30 days. You can stop sharing your location at any time from
            your dashboard.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Children</h2>
          <p className="mt-3">
            {SITE_NAME} is not intended for anyone under 18, and we do not knowingly collect
            information from children. If you believe a child has given us information, email us and
            we will delete it.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Security</h2>
          <p className="mt-3">
            Access to member data is enforced at the database level, so one member&apos;s account
            cannot read another&apos;s private records. Veterinary documents are stored in
            access-controlled storage. No system is perfect; if we ever discover a breach affecting
            your information, we will tell you.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Changes</h2>
          <p className="mt-3">
            If we change this policy in a way that affects what we collect or who sees it, we will
            update the date above and notify members by email.
          </p>
        </section>

        <section>
          <h2 className="text-ink fp-h4">Contact</h2>
          <p className="mt-3">
            Questions about privacy go to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <p className="border-t pt-6 text-sm text-ink-soft">
          See also our{' '}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
