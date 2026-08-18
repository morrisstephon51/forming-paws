import { createClient } from '@/lib/supabase/server'
import { getRequestOrigin } from '@/lib/auth/redirects'
import { NextResponse } from 'next/server'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const VALID_DOC_TYPES = ['vet_exam', 'vaccination', 'ofa', 'dna_panel']
const ALLOWED_MIME_TYPES = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const formData = await request.formData()
  const dogId = String(formData.get('dogId'))
  const docType = String(formData.get('docType'))
  const documentDate = String(formData.get('documentDate'))
  const file = formData.get('file') as File | null

  if (!VALID_DOC_TYPES.includes(docType)) {
    return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 5MB limit' }, { status: 400 })
  }
  const extension = ALLOWED_MIME_TYPES.get(file.type)
  if (!extension) {
    return NextResponse.json({ error: 'File must be a PDF, JPEG, or PNG' }, { status: 400 })
  }

  const parsedDate = new Date(documentDate)
  if (!documentDate || Number.isNaN(parsedDate.getTime()) || parsedDate > new Date()) {
    return NextResponse.json({ error: 'Invalid document date' }, { status: 400 })
  }

  const { data: dog } = await supabase.from('dogs').select('owner_id').eq('id', dogId).single()
  if (!dog || dog.owner_id !== userData.user.id) {
    return NextResponse.json({ error: 'Not your dog' }, { status: 403 })
  }

  const storagePath = `${dogId}/${crypto.randomUUID()}.${extension}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('health-docs')
    .upload(storagePath, buffer, { contentType: file.type })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { error: insertError } = await supabase.from('health_documents').insert({
    dog_id: dogId,
    storage_path: storagePath,
    doc_type: docType,
    document_date: documentDate,
  })
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.redirect(new URL(`/dogs/${dogId}`, getRequestOrigin(request)), 303)
}
