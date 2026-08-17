import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ExpressInterestForm from './ExpressInterestForm'
import { pageMetadata } from '@/lib/seo'
import { formatCalendarDate } from '@/lib/dates'

export const metadata = pageMetadata({
  title: 'Dog profile',
  description: 'Breed, age, health verification status and photos for this dog.',
  path: '/dogs/[id]',
  index: false,
})

export default async function DogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: ownDog } = await supabase
    .from('dogs')
    .select('id, owner_id, name, sex, birth_date, weight_lbs, temperament_notes, breeds(name)')
    .eq('id', id)
    .maybeSingle()

  const isOwnDog = !!ownDog

  let dog: {
    id: string
    owner_id: string
    name: string
    sex: string
    birth_date: string
    temperament_notes?: string | null
    breedName: string
  }

  if (ownDog) {
    dog = { ...ownDog, breedName: (ownDog.breeds as unknown as { name: string })?.name }
  } else {
    const { data: browsableDog, error } = await supabase
      .from('dogs_browsable')
      .select('id, owner_id, name, breed_name, sex, birth_date')
      .eq('id', id)
      .maybeSingle()

    if (error || !browsableDog) notFound()

    // dogs_browsable deliberately does NOT filter deactivated owners — it is
    // also what resolves dog names inside existing conversations and the admin
    // review queue, and filtering it there would blank those names (migration
    // 0022 explains this at length). So the check lives here instead: a direct
    // URL to a departing member's dog should 404 for everyone but its owner.
    //
    // Via the RPC, not `select deactivated_at from owners`: owners' RLS is
    // owner-own-row-only, so reading someone else's row returns nothing and the
    // check would quietly pass for every dog on the site.
    const { data: ownerActive } = await supabase.rpc('owner_is_active', {
      p_owner_id: browsableDog.owner_id,
    })

    if (!ownerActive) notFound()

    dog = { ...browsableDog, breedName: browsableDog.breed_name }
  }

  const { data: photos } = await supabase
    .from('dog_photos')
    .select('id, storage_path')
    .eq('dog_id', id)
    .order('position')

  const { data: healthDocs } = isOwnDog
    ? await supabase
        .from('health_documents')
        .select('id, doc_type, document_date, status')
        .eq('dog_id', id)
        .order('uploaded_at', { ascending: false })
    : { data: null }

  const { data: isVerified } = await supabase.rpc('dog_is_baseline_verified', { p_dog_id: id })

  const photoUrls = await Promise.all(
    (photos ?? []).map(async (p) => {
      const { data } = await supabase.storage.from('dog-photos').createSignedUrl(p.storage_path, 3600)
      return { id: p.id, url: data?.signedUrl }
    })
  )

  let myVerifiedDogs: { id: string; name: string; isVerified: boolean }[] = []
  if (!isOwnDog) {
    const { data: myDogs } = await supabase
      .from('dogs')
      .select('id, name')
      .eq('owner_id', userData.user.id)
    myVerifiedDogs = await Promise.all(
      (myDogs ?? []).map(async (d) => {
        const { data: verified } = await supabase.rpc('dog_is_baseline_verified', { p_dog_id: d.id })
        return { id: d.id, name: d.name, isVerified: !!verified }
      })
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">{dog.name}</h1>
      {isVerified ? (
        <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mt-1">
          ✓ Baseline health verified
        </span>
      ) : (
        <span className="inline-block bg-brand-soft text-ink-soft text-xs px-2 py-1 rounded mt-1">
          Health verification pending
        </span>
      )}
      <p className="text-ink-soft">
        {dog.breedName} · {dog.sex} · born {formatCalendarDate(dog.birth_date)}
      </p>
      {isOwnDog && dog.temperament_notes && <p className="mt-4">{dog.temperament_notes}</p>}

      {!isOwnDog && <ExpressInterestForm targetDogId={dog.id} myDogs={myVerifiedDogs} />}

      <h2 className="mt-8 text-lg font-semibold">Photos</h2>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {photoUrls.map((p) =>
          p.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt={dog.name} className="rounded aspect-square object-cover" />
          ) : null
        )}
      </div>
      {isOwnDog && (
        <form
          action={`/api/upload/photo`}
          method="POST"
          encType="multipart/form-data"
          className="mt-4 flex gap-2"
        >
          <input type="hidden" name="dogId" value={dog.id} />
          <input type="file" name="file" accept="image/*" required />
          <button type="submit" className="bg-brand text-white px-3 py-1 rounded text-sm">
            Upload photo
          </button>
        </form>
      )}

      {isOwnDog && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Health documents</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {healthDocs?.map((doc) => (
              <li key={doc.id} className="flex justify-between border p-2 rounded text-sm">
                <span>
                  {doc.doc_type} ({formatCalendarDate(doc.document_date)})
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
            <button type="submit" className="bg-brand text-white px-3 py-1 rounded text-sm">
              Upload document
            </button>
          </form>
        </>
      )}
    </main>
  )
}
