import type { Metadata } from 'next'
import './globals.css'
import HashSessionRecovery from './auth/HashSessionRecovery'

export const metadata: Metadata = {
  title: 'Forming Paws',
  description: 'Health-first, safety-first dog breeding matchmaking',
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
