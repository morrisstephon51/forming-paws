import type { SupabaseClient } from '@supabase/supabase-js'

export async function getThumbnailUrl(
  supabase: SupabaseClient,
  dogId: string
): Promise<string | null> {
  const { data: photo } = await supabase
    .from('dog_photos')
    .select('storage_path')
    .eq('dog_id', dogId)
    .order('position')
    .limit(1)
    .maybeSingle()

  if (!photo) return null

  const { data } = await supabase.storage.from('dog-photos').createSignedUrl(photo.storage_path, 3600)

  return data?.signedUrl ?? null
}
