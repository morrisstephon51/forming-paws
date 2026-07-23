'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  cityLabel: z.string().trim().min(1).max(120),
})

export async function updateMyLocation(latitude: number, longitude: number, cityLabel: string) {
  const parsed = locationSchema.safeParse({ latitude, longitude, cityLabel })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')

  const { error } = await supabase
    .from('owners')
    .update({
      location_point: `SRID=4326;POINT(${parsed.data.longitude} ${parsed.data.latitude})`,
      location_label: parsed.data.cityLabel,
    })
    .eq('id', userData.user.id)

  if (error) throw error
  revalidatePath('/dashboard')
  revalidatePath('/browse')
}
