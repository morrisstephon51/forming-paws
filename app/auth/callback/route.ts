import { handleAuthLink } from '@/lib/auth/link'

/**
 * OAuth return point (Google), and the landing spot for any emailed link that
 * still carries `?code=`.
 *
 * A provider's own error is passed through verbatim rather than replaced with
 * confirmation-email wording: "provider is not enabled" is a configuration
 * problem, and offering to re-send an email would send the member in circles.
 */
export async function GET(request: Request) {
  return handleAuthLink(request, { offerResendOnLinkError: false })
}
