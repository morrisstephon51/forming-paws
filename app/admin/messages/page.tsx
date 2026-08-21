import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { markHandled } from './actions'
import { RESPONSE_TIME } from '@/lib/promise'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Contact messages',
  description: 'Messages sent through the public contact form.',
  path: '/admin/messages',
  index: false,
})

/**
 * Where the contact form lands. It exists because the form writes to the
 * database rather than sending mail — a queue nobody can read is the same as
 * dropping the message.
 */
export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: owner } = await supabase
    .from('owners')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single()
  if (!owner?.is_admin) redirect('/home')

  const { data: messages } = await supabase
    .from('contact_messages')
    .select('id, name, email, message, created_at, handled_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const waiting = (messages ?? []).filter((m) => !m.handled_at)
  const done = (messages ?? []).filter((m) => m.handled_at)

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="fp-h2">Contact messages</h1>
        <Link href="/home" className="text-sm underline text-ink-soft">
          Back to dashboard
        </Link>
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        The site promises a reply {RESPONSE_TIME.within}, so anything here older than that is
        already late.
      </p>

      <h2 className="mt-8 fp-h5">
        Waiting on a reply{waiting.length > 0 && ` (${waiting.length})`}
      </h2>
      {waiting.length === 0 && <p className="mt-2 text-ink-soft">Nothing waiting.</p>}
      <ul className="mt-4 flex flex-col gap-4">
        {waiting.map((message) => (
          <li key={message.id} className="rounded border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{message.name}</p>
              <time className="text-xs text-ink-soft" dateTime={message.created_at}>
                {new Date(message.created_at).toLocaleString()}
              </time>
            </div>
            <a href={`mailto:${message.email}`} className="text-sm underline text-ink-soft">
              {message.email}
            </a>
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{message.message}</p>
            <form
              action={async () => {
                'use server'
                await markHandled(message.id)
              }}
              className="mt-4"
            >
              <button className="rounded border px-3 py-1 text-sm hover:bg-brand-soft">
                Mark replied
              </button>
            </form>
          </li>
        ))}
      </ul>

      {done.length > 0 && (
        <>
          <h2 className="mt-10 fp-h5">Replied</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {done.map((message) => (
              <li key={message.id} className="rounded border p-3 text-sm text-ink-soft">
                <span className="font-medium text-ink">{message.name}</span> · {message.email} ·{' '}
                {new Date(message.created_at).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
