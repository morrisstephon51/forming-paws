'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateMyLocation(latitude: number, longitude: number, cityLabel: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')

  const { error } = await supabase
    .from('owners')
    .update({
      location_point: `SRID=4326;POINT(${longitude} ${latitude})`,
      location_label: cityLabel,
    })
    .eq('id', userData.user.id)

  if (error) throw error
  revalidatePath('/dashboard')
  revalidatePath('/browse')
}
