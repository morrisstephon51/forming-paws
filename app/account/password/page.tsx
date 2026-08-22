import { pageMetadata } from '@/lib/seo'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PasswordForm from './PasswordForm'

export const metadata = pageMetadata({
  title: 'Set a new password',
  description: 'Choose a new password for your Forming Paws account.',
  path: '/account/password',
  index: false,
})

/**
 * Where a password-recovery link lands, and where a signed-in member can change
 * their password on purpose.
 *
 * The recovery link itself is what creates the session — /auth/confirm consumes
 * it and forwards here — so by the time this page renders, the visitor is
 * already authenticated. No session means someone reached the URL directly.
 */
export default async function PasswordPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    const message =
      'Open the reset link from your email first, then you can choose a new password.'
    redirect(`/login?error=${encodeURIComponent(message)}`)
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="fp-h2">Set a new password</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Signed in as {data.user.email}. Choose a new password and we&apos;ll take you back to your
        dogs.
      </p>
      <PasswordForm />
    </main>
  )
}
