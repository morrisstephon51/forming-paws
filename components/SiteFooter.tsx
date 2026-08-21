import Link from 'next/link'
import Logo from './Logo'
import Sage from './mascot/Sage'
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
    <footer className="mt-20 border-t border-brand/15 py-8 text-sm text-ink-soft">
      <p className="flex flex-wrap items-center gap-x-2">
        <Logo size="sm" />
        <span>
          <strong className="text-ink">{SITE_NAME}</strong> — a nonprofit initiative for healthy,
          responsible dog breeding.
        </span>
      </p>
      <p className="mt-2">
        {SITE_NAME} is not a party to any breeding arrangement. Always consult your veterinarian.
      </p>

      <nav aria-label="Footer" className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        <Link href="/" className="fp-link">
          Home
        </Link>
        <Link href="/about" className="fp-link">
          About
        </Link>
        <Link href="/education" className="fp-link">
          Learn
        </Link>
        <Link href="/vets" className="fp-link">
          Vet partners
        </Link>
        <Link href="/donate" className="fp-link">
          Support us
        </Link>
        <Link href="/app" className="fp-link">
          See the app
        </Link>
        <Link href="/faq" className="fp-link">
          FAQ
        </Link>
        <Link href="/contact" className="fp-link">
          Contact
        </Link>
        <Link href="/signup" className="fp-link">
          Join free
        </Link>
        <Link href="/privacy" className="fp-link">
          Privacy Policy
        </Link>
        <Link href="/terms" className="fp-link">
          Terms of Service
        </Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className="fp-link">
          {CONTACT_EMAIL}
        </a>
      </nav>

      {/*
        The sign-off. Sage sits here rather than beside the logo, where the two
        marks were competing for the same job — the paw is the brand, this is
        just the dog seeing you out.
      */}
      <p className="mt-4 flex items-center gap-2">
        <Sage mood="happy" size={30} />
        {RESPONSE_TIME.sentence}
      </p>
    </footer>
  )
}
