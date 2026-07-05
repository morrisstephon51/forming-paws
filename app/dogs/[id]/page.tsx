import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

export default async function DogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: dog, error } = await supabase
    .from('dogs')
    .select('id, name, sex, birth_date, weight_lbs, temperament_notes, breeds(name)')
    .eq('id', id)
    .single()

  if (error || !dog) notFound()

  const { data: photos } = await supabase
    .from('dog_photos')
    .select('id, storage_path')
    .eq('dog_id', id)
    .order('position')

  const { data: healthDocs } = await supabase
    .from('health_documents')
    .select('id, doc_type, document_date, status')
    .eq('dog_id', id)
    .order('uploaded_at', { ascending: false })

  const { data: isVerified } = await supabase.rpc('dog_is_baseline_verified', { p_dog_id: id })

  const photoUrls = await Promise.all(
    (photos ?? []).map(async (p) => {
      const { data } = await supabase.storage
        .from('dog-photos')
        .createSignedUrl(p.storage_path, 3600)
      return { id: p.id, url: data?.signedUrl }
    })
  )

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">{dog.name}</h1>
      {isVerified ? (
        <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mt-1">
          ✓ Baseline health verified
        </span>
      ) : (
        <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded mt-1">
          Health verification pending
        </span>
      )}
      <p className="text-gray-600">
        {(dog.breeds as unknown as { name: string })?.name} · {dog.sex} · born {dog.birth_date}
      </p>
      {dog.temperament_notes && <p className="mt-4">{dog.temperament_notes}</p>}

      <h2 className="mt-8 text-lg font-semibold">Photos</h2>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {photoUrls.map((p) =>
          p.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt={dog.name} className="rounded aspect-square object-cover" />
          ) : null
        )}
      </div>
      <form
        action={`/api/upload/photo`}
        method="POST"
        encType="multipart/form-data"
        className="mt-4 flex gap-2"
      >
        <input type="hidden" name="dogId" value={dog.id} />
        <input type="file" name="file" accept="image/*" required />
        <button type="submit" className="bg-gray-900 text-white px-3 py-1 rounded text-sm">
          Upload photo
        </button>
      </form>

      <h2 className="mt-8 text-lg font-semibold">Health documents</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {healthDocs?.map((doc) => (
          <li key={doc.id} className="flex justify-between border p-2 rounded text-sm">
            <span>
              {doc.doc_type} ({doc.document_date})
            </span>
            <span
              className={
                doc.status === 'verified'
                  ? 'text-green-600'
                  : doc.status === 'rejected'
                    ? 'text-red-600'
                    : 'text-yellow-600'
              }
            >
              {doc.status}
            </span>
          </li>
        ))}
      </ul>
      <form
        action="/api/upload/health-doc"
        method="POST"
        encType="multipart/form-data"
        className="mt-4 flex flex-col gap-2 max-w-xs"
      >
        <input type="hidden" name="dogId" value={dog.id} />
        <select name="docType" required className="border p-2">
          <option value="vet_exam">Vet wellness exam</option>
          <option value="vaccination">Vaccination record</option>
          <option value="ofa">OFA hip/elbow certification</option>
          <option value="dna_panel">DNA panel</option>
        </select>
        <input name="documentDate" type="date" required className="border p-2" />
        <input type="file" name="file" accept="application/pdf,image/*" required />
        <button type="submit" className="bg-gray-900 text-white px-3 py-1 rounded text-sm">
          Upload document
        </button>
      </form>
    </main>
  )
}
