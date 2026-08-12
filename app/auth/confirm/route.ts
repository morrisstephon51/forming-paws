import { handleAuthLink } from '@/lib/auth/link'

/**
 * Landing point for every emailed auth link: signup confirmation, magic link,
 * password recovery, email change.
 *
 * Both link shapes are handled in `lib/auth/link.ts` — see the note there on why
 * this route cannot assume which one the Supabase email template will send.
 */
export async function GET(request: Request) {
  return handleAuthLink(request)
}
