import { getBreeds } from '@/lib/breeds'
import NewDogForm from './NewDogForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NewDogPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const breeds = await getBreeds()
  return <NewDogForm breeds={breeds} />
}
