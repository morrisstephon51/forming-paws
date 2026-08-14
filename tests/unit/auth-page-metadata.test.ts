import { describe, it, expect } from 'vitest'
import type { Metadata } from 'next'
import { metadata as loginMetadata } from '@/app/(auth)/login/page'
import { metadata as signupMetadata } from '@/app/(auth)/signup/page'

/**
 * `(auth)` is a route group: Next.js strips it from the URL, so these pages are
 * served at `/login` and `/signup`, not `/(auth)/login` and `/(auth)/signup`.
 *
 * The canonical tag and Open Graph url must use the served path. A path carrying
 * the group segment resolves against `metadataBase` to a parenthesised URL that
 * 404s, contradicts what the sitemap advertises, and — on the one page a crawler
 * is allowed to index behind the group — points search engines at a page that
 * does not exist. This is the exact leak that shipped for `/login`.
 */

/** pageMetadata stores the raw path in alternates.canonical and openGraph.url. */
function canonicalOf(metadata: Metadata): string {
  const canonical = metadata.alternates?.canonical
  return typeof canonical === 'string' ? canonical : String(canonical)
}

function ogUrlOf(metadata: Metadata): string {
  const openGraph = metadata.openGraph as { url?: string } | undefined
  return openGraph?.url ?? ''
}

describe('auth page metadata', () => {
  it('canonicalises the login page at its served path, not the route group', () => {
    expect(canonicalOf(loginMetadata)).toBe('/login')
    expect(ogUrlOf(loginMetadata)).toBe('/login')
  })

  it('canonicalises the signup page at its served path', () => {
    expect(canonicalOf(signupMetadata)).toBe('/signup')
    expect(ogUrlOf(signupMetadata)).toBe('/signup')
  })

  it('never leaks a route-group segment into a canonical or share URL', () => {
    for (const metadata of [loginMetadata, signupMetadata]) {
      expect(canonicalOf(metadata)).not.toContain('(')
      expect(ogUrlOf(metadata)).not.toContain('(')
    }
  })
})
