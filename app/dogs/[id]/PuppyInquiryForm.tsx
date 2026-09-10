'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { puppyInquirySchema } from '@/lib/validators/litter'

export default function PuppyInquiryForm({ puppyId }: { puppyId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (success) {
    return (
      <p className="mt-4 text-sm text-green-600">
        Sent. The breeder can see your message and reply to the email on your account.
      </p>
    )
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    const parsed = puppyInquirySchema.safeParse({ message: formData.get('message') })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user?.email) {
      setError('Not signed in')
      return
    }

    const { error: insertError } = await supabase.from('puppy_inquiries').insert({
      puppy_id: puppyId,
      buyer_id: userData.user.id,
      buyer_email: userData.user.email,
      message: parsed.data.message,
    })

    if (insertError) {
      setError(
        insertError.code === '23505' ? 'You already inquired about this puppy' : insertError.message
      )
      return
    }

    setSuccess(true)
    router.refresh()
  }

  return (
    <form action={handleSubmit} className="mt-4 flex flex-col gap-2">
      <textarea
        name="message"
        required
        placeholder="Introduce yourself and ask what you'd like to know"
        className="fp-input text-sm"
        rows={3}
      />
      <button type="submit" className="fp-btn self-start px-4 py-1.5 text-sm">
        Send inquiry
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
