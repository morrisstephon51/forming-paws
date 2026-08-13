import Link from 'next/link'
import SiteFooter from '@/components/SiteFooter'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Page not found',
  description: 'That page does not exist. Here is where to go instead.',
  path: '/404',
  index: false,
})

/**
 * Shown for any URL that doesn't exist, and by `notFound()` from a page whose
 * record is missing — a dog profile that was deleted, a conversation that was
 * closed.
 *
 * Written to be useful rather than decorative: printed flyers and QR codes point
 * at this site, and a mistyped URL from one of those is a real person trying to
 * reach us, not a broken link.
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Error 404</p>
      <h1 className="mt-3 text-3xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-4 text-gray-600">
        The link may be out of date, or the page may have moved when we rebuilt the site. Nothing is
        wrong with your account.
      </p>

      <ul className="mt-8 flex flex-col gap-3">
        <li>
          <Link href="/" className="block rounded-lg border p-4 hover:bg-gray-50">
            <span className="font-semibold">Start at the beginning</span>
            <span className="mt-1 block text-sm text-gray-600">
              What Forming Paws is and how matching works
            </span>
          </Link>
        </li>
        <li>
          <Link href="/signup" className="block rounded-lg border p-4 hover:bg-gray-50">
            <span className="font-semibold">Create your account</span>
            <span className="mt-1 block text-sm text-gray-600">
              Free, and your dog&apos;s profile takes a few minutes
            </span>
          </Link>
        </li>
        <li>
          <Link href="/dashboard" className="block rounded-lg border p-4 hover:bg-gray-50">
            <span className="font-semibold">Go to your dogs</span>
            <span className="mt-1 block text-sm text-gray-600">
              If you already have an account, everything is here
            </span>
          </Link>
        </li>
        <li>
          <Link href="/contact" className="block rounded-lg border p-4 hover:bg-gray-50">
            <span className="font-semibold">Tell us what you were looking for</span>
            <span className="mt-1 block text-sm text-gray-600">
              If a link we published is broken, we want to know
            </span>
          </Link>
        </li>
      </ul>

      <SiteFooter />
    </div>
  )
}
