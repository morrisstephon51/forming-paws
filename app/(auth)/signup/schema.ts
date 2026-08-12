import { z } from 'zod'
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password'

export const signupSchema = z.object({
  email: z.string().email(),
  // Shared with the password-reset form so the two doors into an account can't
  // drift to different strengths.
  password: z.string().min(MIN_PASSWORD_LENGTH),
  displayName: z.string().min(1),
  isAdult: z.literal(true, {
    errorMap: () => ({ message: 'You must confirm you are 18 or older' }),
  }),
})
