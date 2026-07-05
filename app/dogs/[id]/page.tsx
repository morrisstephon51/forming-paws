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

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">{dog.name}</h1>
      <p className="text-gray-600">
        {(dog.breeds as unknown as { name: string })?.name} · {dog.sex} · born {dog.birth_date}
      </p>
      {dog.temperament_notes && <p className="mt-4">{dog.temperament_notes}</p>}
    </main>
  )
}
