import { createClient } from '@/lib/supabase/server'
import { stripImageMetadata, UnsupportedImageError } from '@/lib/image'
import { redirectToPath } from '@/lib/http'
import { NextResponse } from 'next/server'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_PHOTOS_PER_DOG = 5

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const formData = await request.formData()
  const dogId = String(formData.get('dogId'))
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 5MB limit' }, { status: 400 })
  }
  // A cheap, honest rejection for the obvious cases — a PDF, a video, a text
  // file — before we spend memory decoding. `file.type` is client-supplied, so
  // an empty or image/* type falls through to stripImageMetadata, which is the
  // real authority on whether the bytes actually decode.
  if (file.type && !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  const { data: dog } = await supabase.from('dogs').select('owner_id').eq('id', dogId).single()
  if (!dog || dog.owner_id !== userData.user.id) {
    return NextResponse.json({ error: 'Not your dog' }, { status: 403 })
  }

  const { count } = await supabase
    .from('dog_photos')
    .select('id', { count: 'exact', head: true })
    .eq('dog_id', dogId)
  if ((count ?? 0) >= MAX_PHOTOS_PER_DOG) {
    return NextResponse.json({ error: 'Maximum 5 photos per dog' }, { status: 400 })
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer())
  let cleanBuffer: Buffer
  try {
    cleanBuffer = await stripImageMetadata(rawBuffer)
  } catch (err) {
    // A file sharp cannot decode is the uploader's mistake, not a server fault;
    // answer 400 with something they can act on instead of a cryptic 500.
    if (err instanceof UnsupportedImageError) {
      return NextResponse.json(
        { error: 'That file is not a readable image. Please upload a JPEG, PNG, or WebP.' },
        { status: 400 }
      )
    }
    throw err
  }
  const storagePath = `${dogId}/${crypto.randomUUID()}.jpg`

  const { error: uploadError } = await supabase.storage
    .from('dog-photos')
    .upload(storagePath, cleanBuffer, { contentType: 'image/jpeg' })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { error: insertError } = await supabase
    .from('dog_photos')
    .insert({ dog_id: dogId, storage_path: storagePath, position: count ?? 0 })
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return redirectToPath(request, `/dogs/${dogId}`)
}
