import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; resend?: string }>
}) {
  const params = await searchParams

  return <LoginForm error={params.error ?? null} offerResend={params.resend === '1'} />
}
