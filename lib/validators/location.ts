import { z } from 'zod'

export const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  cityLabel: z.string().trim().min(1).max(120),
})
