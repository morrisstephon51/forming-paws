import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
import SiteFooter from '@/components/SiteFooter'
import ContactForm from './ContactForm'
import { RESPONSE_TIME } from '@/lib/promise'
import { CONTACT_EMAIL } from '@/lib/site'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Contact us',
  description: `Questions about health verification, your account, or a broken link? Send a message and we reply ${RESPONSE_TIME.within}.`,
  path: '/contact',
})

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10 pb-28 sm:pb-10">
      <Breadcrumbs trail={[{ label: 'Contact' }]} />

      <main>

      <h1 className="mt-6 fp-h1">Talk to a person</h1>

      <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">
        <strong>{RESPONSE_TIME.sentence}</strong> Every message goes to the team behind Forming
        Paws, not a queue.
      </p>

      <p className="mt-4 text-ink-soft">
        Health verification questions, trouble with your account, a link that didn&apos;t work, or a
        concern about another member — all of it belongs here. If you would rather use your own mail
        app, write to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <p className="mt-4 text-sm text-ink-soft">
        Before you write: the{' '}
        <Link href="/faq" className="underline">
          FAQ
        </Link>{' '}
        covers cost, what verification involves, and how your location stays private. To report
        another member, use the report button inside the conversation — that reaches the same team
        with the messages attached.
      </p>

      <ContactForm />

      </main>

      <SiteFooter />
    </div>
  )
}
