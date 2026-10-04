/**
 * Resolve the origin the browser actually asked for.
 *
 * Behind a proxy (Vercel) `request.url` carries the internal host, so a redirect
 * built from it can point somewhere the user cannot reach. `x-forwarded-host` is
 * the host that appeared in the address bar.
 */
export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')

  if (!forwardedHost) return url.origin

  const forwardedProto = request.headers.get('x-forwarded-proto')
  const proto = forwardedProto ?? (url.protocol === 'http:' ? 'http' : 'https')

  return `${proto}://${forwardedHost}`
}

/**
 * Confirmation links carry a `next` destination, and the link itself is
 * attacker-suppliable. Only same-origin relative paths are honoured so a crafted
 * link can't bounce a freshly-authenticated user off to another site.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = '/home'): string {
  if (!next) return fallback
  // `//evil.com` and `/\evil.com` are protocol-relative — browsers treat them as absolute.
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}

/** Build a `/login` URL that carries a human-readable reason for landing there. */
export function loginUrlWithError(origin: string, message: string, canResend = false): string {
  const params = new URLSearchParams({ error: message })
  if (canResend) params.set('resend', '1')
  return `${origin}/login?${params.toString()}`
}

/**
 * The request header middleware uses to tell server components which page was
 * asked for. A server component cannot read its own URL, and a gated page needs
 * it to send a signed-out visitor to /login with a way back.
 */
export const REQUEST_PATH_HEADER = 'x-fp-path'

/** Never a destination after signing in: both would put the member straight back on a form. */
const AUTH_PAGES = ['/login', '/signup']

/**
 * Where to send a member once they have signed in: a same-origin path (see
 * safeRedirectPath), and never back to the sign-in or sign-up page.
 */
export function postLoginPath(next: string | null | undefined): string {
  const path = safeRedirectPath(next)
  const pathname = path.split(/[?#]/)[0]
  const isAuthPage = AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))
  return isAuthPage ? '/home' : path
}

/**
 * The /login URL for a signed-out visitor who asked for `requested`.
 *
 * Carries the page as `next`. Without it, signing in always landed on /home, so
 * anyone who opened a gated link in a browser where they were not yet signed in
 * (an admin opening /admin in Safari, say) signed in and lost the page they came
 * for, with nothing on /home pointing back to it.
 */
export function loginPathFor(requested: string | null | undefined): string {
  const next = postLoginPath(requested)
  return next === '/home' ? '/login' : `/login?${new URLSearchParams({ next }).toString()}`
}
