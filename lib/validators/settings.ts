import { z } from 'zod'

/**
 * Kept out of the 'use server' action file: a module with 'use server' may only
 * export async functions, so a schema constant cannot live there. Same reason
 * locationSchema sits in lib/validators/location.ts.
 */

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Your name needs at least 2 characters.')
  .max(60, 'Please keep your name under 60 characters.')

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('That does not look like an email address.')
  .max(254, 'That email address is too long.')

export const notificationPrefsSchema = z.object({
  notify_matches: z.boolean(),
  notify_messages: z.boolean(),
  notify_health_reviews: z.boolean(),
})

export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>

/**
 * The phrase a member has to type to confirm deletion.
 *
 * Compared case-insensitively and with surrounding whitespace trimmed — the
 * point of the confirmation is proving intent, not testing typing. Anything
 * stricter just makes people paste it, which proves nothing.
 */
export const DELETE_CONFIRMATION = 'delete my account'

export function isDeleteConfirmed(input: string): boolean {
  return input.trim().toLowerCase() === DELETE_CONFIRMATION
}

/** How long a deactivated account is recoverable before the purge takes it. */
export const PURGE_GRACE_DAYS = 30

export function purgeDateFrom(deactivatedAt: Date): Date {
  const due = new Date(deactivatedAt)
  due.setUTCDate(due.getUTCDate() + PURGE_GRACE_DAYS)
  return due
}
