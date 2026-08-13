import Link from 'next/link'
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site'
import { RESPONSE_TIME } from '@/lib/promise'

/**
 * The same footer on every public page, so each one links onward to the others.
 *
 * Single-sourced deliberately: a footer copied into five files is a footer that
 * ends up listing five different sets of pages.
 */
export default function SiteFooter() {
  return (
    <footer className="mt-20 border-t py-8 text-sm text-gray-600">
      <p>
        🐾 <strong>{SITE_NAME}</strong> — a nonprofit initiative for healthy, responsible dog
        breeding.
      </p>
      <p className="mt-2">
        {SITE_NAME} is not a party to any breeding arrangement. Always consult your veterinarian.
      </p>

      <nav aria-label="Footer" className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        <Link href="/" className="underline">
          Home
        </Link>
        <Link href="/app" className="underline">
          See the app
        </Link>
        <Link href="/faq" className="underline">
          FAQ
        </Link>
        <Link href="/contact" className="underline">
          Contact
        </Link>
        <Link href="/signup" className="underline">
          Join free
        </Link>
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        <Link href="/terms" className="underline">
          Terms of Service
        </Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
          {CONTACT_EMAIL}
        </a>
      </nav>

      <p className="mt-4">{RESPONSE_TIME.sentence}</p>
    </footer>
  )
}
