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
