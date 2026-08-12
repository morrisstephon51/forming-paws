/**
 * Supabase's own floor is 6 characters. Sign-up asks for 8, so a reset must not
 * quietly be the weaker door into the same account.
 */
export const MIN_PASSWORD_LENGTH = 8

/**
 * Returns the reason a new password can't be accepted, or null if it can.
 *
 * Checked in the browser purely so the member hears about a typo before a round
 * trip — Supabase enforces its own rules server-side regardless.
 */
export function newPasswordError(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  // Caught here rather than after saving, because a mistyped confirmation on a
  // reset locks someone out of the account they were trying to get back into.
  if (password !== confirmation) {
    return 'Those two passwords do not match.'
  }
  return null
}
