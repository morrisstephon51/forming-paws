import { z } from 'zod'
import { isBirthDateNotInFuture } from '@/lib/dogBirthDate'

export const newLitterSchema = z.object({
  sireId: z.string().uuid(),
  damId: z.string().uuid(),
  bornOn: z.string().optional(),
  readyOn: z.string().optional(),
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
