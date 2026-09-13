import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { REQUEST_PATH_HEADER } from '@/lib/auth/redirects'
import { createResilientFetch } from '@/lib/supabase/fetch'

export async function middleware(request: NextRequest) {
  // Tells server components which page was asked for, so a gated page can send
  // a signed-out visitor to /login with a way back (lib/auth/login-redirect.ts).
  // Always overwritten, so a client cannot supply its own, and only ever read
  // through postLoginPath, which accepts same-origin paths alone.
  request.headers.set(REQUEST_PATH_HEADER, requestedPath(request))

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: createResilientFetch() },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

/** The path and query the browser asked for, minus Next's internal RSC cache-buster. */
function requestedPath(request: NextRequest): string {
  const url = request.nextUrl.clone()
  url.searchParams.delete('_rsc')
  return `${url.pathname}${url.search}`
}

export const config = {
  matcher: [
    /*
     * Every route except build output and static files. A member's page load
     * pulls a dozen images, scripts and stylesheets from public/, and each one
     * used to pass through here and spend a Supabase auth round trip on a file
     * that has nothing to do with the session.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|txt|xml|woff|woff2|mp4|webm|pdf)$).*)',
  ],
}
