import { headers } from 'next/headers'
import { loginPathFor, REQUEST_PATH_HEADER } from '@/lib/auth/redirects'

/**
 * The /login URL for the page this request is rendering, carrying it as `next`
 * so the visitor comes back here after signing in. Plain /login when middleware
 * did not supply the path.
 *
 * Returns the path instead of redirecting, so call sites read
 * `redirect(await loginRedirectPath())`. TypeScript only narrows after a direct
 * call to a function that returns `never`; an awaited helper would lose that,
 * and every `userData.user` after the guard would read as possibly null.
 */
export async function loginRedirectPath(): Promise<string> {
  return loginPathFor((await headers()).get(REQUEST_PATH_HEADER))
}
