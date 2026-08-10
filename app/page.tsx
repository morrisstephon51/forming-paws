import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LoginForm from './(auth)/login/LoginForm'
import { safeEmailParam } from '@/lib/auth/prefill'

/**
 * The app's front door. Members arriving from the marketing site's hand-off
 * link land here with `?email=` already filled in, so signing in is one field
 * away rather than another page load.
 *
 * Credentials are handled by LoginForm and nowhere else — this page supplies
 * layout only.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; resend?: string; email?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="text-lg font-bold">🐾 Forming Paws</span>
        {data.user ? (
          <Link href="/dashboard" className="text-sm underline text-gray-600">
            Your dashboard
          </Link>
        ) : (
          <Link href="/signup" className="text-sm underline text-gray-600">
            Create an account
          </Link>
        )}
      </header>

      <div className="mt-16 grid gap-12 md:grid-cols-2 md:items-start">
        <section>
          <h1 className="text-4xl font-bold leading-tight">
            Healthy matches.
            <br />
            Happy litters.
          </h1>
          <p className="mt-4 text-gray-600">
            Forming Paws connects dog owners nearby for safe, health-documented breeding matches —
            with veterinary verification at the centre of everything.
          </p>
          <ul className="mt-6 flex flex-col gap-2 text-sm text-gray-600">
            <li>✅ Matching unlocks only after vet documents are verified</li>
            <li>📍 Find partners by distance — never exact addresses</li>
            <li>🩺 A verified badge means checked records, not an honour system</li>
          </ul>
        </section>

        <section className="rounded-lg border p-6">
          {data.user ? (
            <>
              <h2 className="text-xl font-bold">You&apos;re signed in</h2>
              <p className="mt-2 text-sm text-gray-600">
                Pick up where you left off with your dogs and matches.
              </p>
              <Link
                href="/dashboard"
                className="mt-6 block rounded bg-gray-900 p-2 text-center text-white"
              >
                Go to your dashboard
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">Member sign in</h2>
              <LoginForm
                error={params.error ?? null}
                offerResend={params.resend === '1'}
                initialEmail={safeEmailParam(params.email)}
              />
              <p className="mt-6 border-t pt-6 text-sm text-gray-600">
                New here?{' '}
                <Link href="/signup" className="underline">
                  Create your account and dog profile
                </Link>
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
