'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CONTACT_EMAIL } from '@/lib/site'

const MAX_MESSAGE = 5000

export default function ContactForm() {
  const router = useRouter()
  // Controlled, like every other form here: React clears a form once its action
  // has run, and losing a long message to one bad field is unforgivable.
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please fill in your name, your email and a message.')
      return
    }
    if (message.length > MAX_MESSAGE) {
      setError(`That message is longer than ${MAX_MESSAGE.toLocaleString()} characters.`)
      return
    }

    setSending(true)
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('contact_messages').insert({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    })

    if (insertError) {
      // The message is still in the box, so nothing they wrote is lost — and the
      // fallback address is spelled out rather than hinted at.
      setError(
        `We could not save that — please email ${CONTACT_EMAIL} instead, and your message stays in the box below so you can copy it.`
      )
      setSending(false)
      return
    }

    router.push('/thank-you?from=contact')
  }

  return (
    <form action={handleSubmit} className="mt-8 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Your name
        </label>
        <input
          id="name"
          name="name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Your email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2"
        />
        <p className="text-xs text-ink-soft">So we can reply. We never add it to a mailing list.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="message" className="text-sm font-medium">
          What can we help with?
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={7}
          maxLength={MAX_MESSAGE}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="border p-2"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="rounded bg-brand p-2 font-semibold text-white disabled:opacity-50"
      >
        {sending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
