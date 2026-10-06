import { z } from 'zod'
import { isBirthDateNotInFuture } from '@/lib/dogBirthDate'

export const newLitterSchema = z
  .object({
    sireId: z.string().uuid(),
    damId: z.string().uuid(),
    // A litter's birth date, once known, has necessarily already happened --
    // reuse the exact guard the puppy birthDate uses (lib/dogBirthDate) so the
    // litter and puppy paths agree. A future born_on would otherwise prefill
    // AddPuppyForm's defaultBirthDate, which the puppy form then rejects. An
    // expected-but-unborn litter simply leaves this null.
    bornOn: z
      .string()
      .refine((d) => isBirthDateNotInFuture(d), {
        message: 'Birth date cannot be in the future',
      })
      .optional(),
    // ready_on stays unbounded above on purpose: it is the day the puppies go
    // to their new homes, typically weeks out, so a future date is normal.
    readyOn: z.string().optional(),
  })
  // Both dates are zero-padded YYYY-MM-DD, so a lexicographic compare is a
  // calendar compare -- a litter cannot be ready before it was born.
  .refine((v) => !v.bornOn || !v.readyOn || v.bornOn <= v.readyOn, {
    message: 'A litter cannot be ready before it was born',
    path: ['readyOn'],
  })

export const newPuppySchema = z.object({
  name: z.string().trim().min(1),
  sex: z.enum(['male', 'female']),
  birthDate: z.string().refine((d) => isBirthDateNotInFuture(d), {
    message: 'Birth date cannot be in the future',
  }),
  // Dollars in the form, cents in the database -- kept as a string through
  // validation so an empty field means "no price shown" (null) rather than 0.
  priceDollars: z.string().optional(),
})

export const puppyInquirySchema = z.object({
  message: z.string().trim().min(1).max(2000),
})
