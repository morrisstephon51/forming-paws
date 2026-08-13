/**
 * Turns whatever Supabase hands back into something a member can act on.
 *
 * Two of these are not hypothetical. When the project's outbound mail is
 * misconfigured, sign-up fails with a 500 whose body carries no usable message,
 * and the form rendered the literal string `{}` at a person trying to join. The
 * other is that same failure when it does name itself — worth translating,
 * because "error sending confirmation email" reads like the account was made and
 * only the email failed. It wasn't: the signup is rolled back, so the honest
 * instruction is to try the whole thing again.
 */
export function humanAuthError(message: string | null | undefined): string {
  const raw = (message ?? '').trim()

  if (!raw || raw === '{}' || raw === '[object Object]' || raw === 'null') {
    return "Something went wrong on our side, not yours. Please try again in a few minutes — and if it keeps happening, contact us and we'll fix it."
  }

  if (/sending (the )?(confirmation|recovery|magic link) email/i.test(raw)) {
    return "We couldn't send your email, so nothing was created. This is a problem on our side. Please try again in a few minutes, or contact us."
  }

  if (/email rate limit exceeded/i.test(raw)) {
    return 'We have hit our email limit for the hour. Please try again shortly — nothing you entered was lost.'
  }

  return raw
}
