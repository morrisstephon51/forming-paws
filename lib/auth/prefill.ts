/** RFC 5321 caps a forward path at 254 characters. */
const MAX_EMAIL_LENGTH = 254

/**
 * Sanitise an `?email=` value used only to pre-fill the sign-in field.
 *
 * The value arrives from the marketing landing page's hand-off link, which
 * means it is attacker-suppliable: anyone can send someone a URL with any
 * `email` they like. It never authenticates anything, but it is rendered back
 * into an input, so it is worth keeping to something address-shaped.
 *
 * Deliberately permissive about the address itself — this is a convenience
 * prefill, not validation. The real check is whatever Supabase does at sign-in.
 * Rejects rather than repairs: a bad value simply yields an empty field.
 */
export function safeEmailParam(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined

  const value = raw.trim()
  if (!value || value.length > MAX_EMAIL_LENGTH) return undefined

  // Control characters, most importantly CR/LF, never belong in an address.
  if (/[\u0000-\u001f\u007f]/.test(value)) return undefined

  const at = value.indexOf('@')
  // Needs at least one character either side, and exactly one `@`.
  if (at < 1 || at !== value.lastIndexOf('@') || at === value.length - 1) return undefined

  return value
}
