import type { Metadata } from 'next'
import './globals.css'
import HashSessionRecovery from './auth/HashSessionRecovery'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  // Makes every relative URL below resolve absolutely, which Open Graph requires.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Healthy Matches. Happy Litters.`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Healthy Matches. Happy Litters.`,
    description: SITE_DESCRIPTION,
    url: '/',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Healthy Matches. Happy Litters.`,
    description: SITE_DESCRIPTION,
  },
  icons: {
    icon: [
      {
        url: '/logo.svg',
        type: 'image/svg+xml',
      },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <HashSessionRecovery />
        {children}
      </body>
    </html>
  )
}
