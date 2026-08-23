import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
import ShareButtons from '@/components/ShareButtons'
import SiteFooter from '@/components/SiteFooter'
import { FAQS, faqSchema } from '@/lib/faq'
import { RESPONSE_TIME } from '@/lib/promise'
import { absoluteUrl, pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Frequently asked questions',
  description:
    'What health verification means, whether joining costs anything, how your location stays private, and how quickly we reply.',
  path: '/faq',
})

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10 pb-28 sm:pb-10">
      <Breadcrumbs trail={[{ label: 'FAQ' }]} />

      <main>

      <h1 className="mt-6 fp-h1">Questions people ask first</h1>
      <p className="mt-3 text-ink-soft">
        If yours isn&apos;t here,{' '}
        <Link href="/contact" className="underline">
          send it to us
        </Link>
        {'. '}We reply {RESPONSE_TIME.within}.
      </p>

      <dl className="mt-10 flex flex-col gap-8">
        {FAQS.map((faq) => (
          <div key={faq.question}>
            <dt className="text-lg font-semibold">{faq.question}</dt>
            <dd className="mt-2 text-ink-soft">{faq.answer}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 rounded-lg border border-hairline bg-ivory p-6">
        <h2 className="fp-h4">Ready when you are</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Creating your account and your dog&apos;s profile takes a few minutes, and costs nothing.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/signup" className="fp-btn">
            Join free
          </Link>
          <Link href="/app" className="fp-btn-ghost">
            See the app first
          </Link>
        </div>
      </div>

      <div className="mt-10">
        <ShareButtons
          url={absoluteUrl('/faq')}
          title="Forming Paws: health-verified breeding matches for dog owners"
        />
      </div>

      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema()) }}
      />
    </div>
  )
}
