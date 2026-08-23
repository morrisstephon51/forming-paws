import LoginForm from './LoginForm'
import { safeEmailParam } from '@/lib/auth/prefill'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Log in',
  description: 'Sign in to Forming Paws to manage your dogs, browse matches and message other owners.',
  path: '/login',
})

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; resend?: string; email?: string }>
}) {
  const params = await searchParams

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="fp-h2">Log in</h1>
      <LoginForm
        error={params.error ?? null}
        offerResend={params.resend === '1'}
        initialEmail={safeEmailParam(params.email)}
      />
    </main>
  )
}
