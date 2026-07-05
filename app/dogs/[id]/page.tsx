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
    </main>
  )
}
