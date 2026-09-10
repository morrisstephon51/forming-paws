import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { pageMetadata } from '@/lib/seo'
import NewLitterForm from './NewLitterForm'

export const metadata = pageMetadata({
  title: 'List a litter',
  description: 'Start a litter from two of your own health-verified dogs.',
  path: '/litters/new',
  index: false,
})

export default async function NewLitterPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: dogs, error } = await supabase
    .from('dogs')
    .select('id, name, sex, litter_id')
    .eq('owner_id', userData.user.id)
    // A puppy listing can't itself be a breeding parent -- filtered here so
    // the form never even offers one, ahead of the database's own check.
    .is('litter_id', null)

  if (error) throw error

  const dogsWithStatus = await Promise.all(
    (dogs ?? []).map(async (dog) => {
      const { data: verified } = await supabase.rpc('dog_is_baseline_verified', {
        p_dog_id: dog.id,
      })
      return { id: dog.id, name: dog.name, sex: dog.sex as 'male' | 'female', isVerified: !!verified }
    })
  )

  return <NewLitterForm dogs={dogsWithStatus} />
}
