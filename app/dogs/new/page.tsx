import { getBreeds } from '@/lib/breeds'
import NewDogForm from './NewDogForm'

export default async function NewDogPage() {
  const breeds = await getBreeds()
  return <NewDogForm breeds={breeds} />
}
