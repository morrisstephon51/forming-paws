import LoginForm from './LoginForm'
import { safeEmailParam } from '@/lib/auth/prefill'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; resend?: string; email?: string }>
}) {
  const params = await searchParams

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-bold">Log in</h1>
      <LoginForm
        error={params.error ?? null}
        offerResend={params.resend === '1'}
        initialEmail={safeEmailParam(params.email)}
      />
    </main>
  )
}
