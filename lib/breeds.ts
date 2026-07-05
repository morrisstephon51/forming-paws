import { createClient } from '@/lib/supabase/server'

export async function getBreeds() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('breeds').select('id, name').order('name')
  if (error) throw error
  return data as { id: number; name: string }[]
}
