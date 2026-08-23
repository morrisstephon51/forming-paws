import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /*
   * AVIF first, WebP second, original last.
   *
   * Next's default is WebP alone, so the AVIF half of this project's imagery
   * budget was never actually being served — the hero was shipping WebP to
   * browsers that would have taken a file roughly a third smaller. The list is
   * ordered by preference and negotiated against the request's Accept header,
   * so anything that cannot decode AVIF still gets WebP, and anything that
   * cannot decode either still gets the JPEG.
   *
   * The cost is encode time on the first request for each size, which AVIF
   * pays more of than WebP. It is paid once per image per width and then
   * cached, and it is a build-server cost rather than a visitor's.
   */
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  async redirects() {
    // theplugai.xyz used to be GitHub Pages serving flat .html files. Those URLs
    // are printed on flyers, sit in QR codes, and are in members' inboxes, so
    // they keep working rather than 404ing.
    //
    // `admin.html` is deliberately absent: it still exists as a real file in
    // public/ and is served as-is. Redirects are evaluated before the public/
    // directory, so anything listed here would shadow its file — which is
    // exactly how /app.html below retires the old static demo.
    //
    // permanent: false (307) on purpose during the cutover. A 308 is cached hard
    // by browsers and would be painful to walk back mid-migration; these can be
    // promoted once the move has settled.
    return [
      // Insurance for auth links that land on the Site URL instead of the
      // redirect they asked for — which is what Supabase falls back to when a
      // redirect target isn't on its allow list. Without this the code sits on
      // the marketing page, unconsumed, and the member is silently not signed in.
      {
        source: '/',
        has: [{ type: 'query', key: 'code' }],
        destination: '/auth/confirm',
        permanent: false,
      },
      { source: '/index.html', destination: '/', permanent: false },
      // The static sample-dogs demo is now a real page at /app.
      { source: '/app.html', destination: '/app', permanent: false },
      { source: '/join.html', destination: '/signup', permanent: false },
      { source: '/login.html', destination: '/login', permanent: false },
      { source: '/home.html', destination: '/home', permanent: false },
      // /dashboard is retired in favour of /home. Members have it bookmarked and
      // it is where older emailed links point, so it redirects rather than 404s.
      { source: '/dashboard', destination: '/home', permanent: false },
      // Emailed auth links carry either ?token_hash= (a {{ .TokenHash }}
      // template) or ?code= (the stock {{ .ConfirmationURL }} template, which
      // bounces the click through Supabase's own /verify endpoint first).
      // /auth/confirm handles both; query strings are forwarded automatically.
      {
        source: '/confirm.html',
        has: [{ type: 'query', key: 'token_hash' }],
        destination: '/auth/confirm',
        permanent: false,
      },
      {
        source: '/confirm.html',
        has: [{ type: 'query', key: 'code' }],
        destination: '/auth/confirm',
        permanent: false,
      },
      // Older implicit-flow links carry the session in the URL *fragment*, which
      // never reaches the server. Sending those to the app root lets
      // HashSessionRecovery — which mounts in the root layout — claim the
      // session in the browser. /auth/confirm is a route handler with no React
      // tree and could never see it.
      { source: '/confirm.html', destination: '/', permanent: false },
    ]
  },
}

export default nextConfig
