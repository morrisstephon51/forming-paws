import { NextResponse } from 'next/server'
import { getRequestOrigin } from '@/lib/auth/redirects'

/**
 * A same-origin redirect that survives the proxy.
 *
 * `new URL(path, request.url)` looks harmless, but behind Vercel `request.url`
 * carries the internal deployment host, so the browser is sent to a host it
 * never asked for — off the custom domain, and often straight into a
 * deployment-protection wall. That is the same trap `getRequestOrigin` exists to
 * close for the auth flow (see lib/auth/redirects.ts); this puts every POST-form
 * redirect on the same footing so a member who just uploaded a photo lands back
 * on the page they came from, on the domain in their address bar.
 *
 * 303 by default: a POST-form submit must redirect to a GET, not replay the POST.
 */
export function redirectToPath(request: Request, path: string, status = 303): NextResponse {
  return NextResponse.redirect(new URL(path, getRequestOrigin(request)), status)
}
