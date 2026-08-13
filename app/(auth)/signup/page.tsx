import SignupForm from './SignupForm'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Create your account',
  description:
    'Join Forming Paws free. Create a profile for your dog, upload vet records for verification, and find health-documented breeding matches near you.',
  path: '/signup',
})

export default function SignupPage() {
  return <SignupForm />
}
