import { getBreeds } from '@/lib/breeds'
import NewDogForm from './NewDogForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { loginRedirectPath } from '@/lib/auth/login-redirect'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Add your dog',
  description: 'Create a profile for your dog: breed, age, sex, temperament and photos.',
  path: '/dogs/new',
  index: false,
})

export default async function NewDogPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect(await loginRedirectPath())

  const breeds = await getBreeds()
  return <NewDogForm breeds={breeds} />
}
