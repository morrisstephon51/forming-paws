'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage, blockMatch, unblockMatch } from './actions'

export type ThreadMessage = {
  id: string
  body: string
  sender_owner_id: string
  created_at: string
}

export default function Thread({
  matchId,
  myOwnerId,
  theirDogName,
  initialMessages,
  blocked,
  blockedByMe,
  canParticipate,
}: {
  matchId: string
  myOwnerId: string
  theirDogName: string
  initialMessages: ThreadMessage[]
  blocked: boolean
  blockedByMe: boolean
  /** False for an admin reading under a report: they may read, never write. */
  canParticipate: boolean
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  // The cursor lives in a ref rather than state: putting it in the effect's
  // dependency array would tear down and rebuild the interval on every new
  // message, which resets the timer and can drop a poll.
  const cursorRef = useRef<string | null>(initialMessages.at(-1)?.created_at ?? null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      // A background tab has nobody looking at it; polling it is pure waste.
      if (document.visibilityState !== 'visible') return

      const supabase = createClient()
      let query = supabase
        .from('messages')
        .select('id, body, sender_owner_id, created_at')
        .eq('match_id', matchId)
        .order('created_at')
      if (cursorRef.current) query = query.gt('created_at', cursorRef.current)

      const { data } = await query
      if (cancelled || !data || data.length === 0) return

      cursorRef.current = data[data.length - 1].created_at
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id))
        return [...prev, ...data.filter((m) => !seen.has(m.id))]
      })
    }

    pollNowRef.current = poll
    const timer = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [matchId])

  const pollNowRef = useRef<null | (() => Promise<void>)>(null)

  async function handleSend(formData: FormData) {
    const body = String(formData.get('body') ?? '').trim()
    if (!body) return

    setSending(true)
    setError(null)
    try {
      await sendMessage(matchId, body)
      setDraft('')
      // The cursor is deliberately left alone; instead of inventing an id
      // client-side (duplicate risk), poll immediately so the sender sees
      // their message now rather than after the next 5s interval.
      await pollNowRef.current?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {messages.map((m) => {
          const mine = m.sender_owner_id === myOwnerId
          return (
            <li
              key={m.id}
              className={`max-w-[80%] rounded-lg border p-3 ${
                mine ? 'self-end bg-brand text-white' : 'self-start bg-white'
              }`}
            >
              <p className="text-xs opacity-70">{mine ? 'You' : theirDogName}</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
            </li>
          )
        })}
        {messages.length === 0 && <p className="text-gray-500">No messages yet — say hello.</p>}
      </ul>

      {!canParticipate ? null : blocked ? (
        <div className="mt-6 rounded border bg-gray-50 p-4 text-sm text-gray-600">
          <p>
            {blockedByMe
              ? 'You closed this conversation.'
              : 'This conversation is no longer available.'}
          </p>
          {blockedByMe && (
            <form
              action={async () => {
                await unblockMatch(matchId)
              }}
              className="mt-3"
            >
              <button type="submit" className="rounded border px-3 py-1.5 text-gray-900">
                Reopen conversation
              </button>
            </form>
          )}
        </div>
      ) : (
        <>
          <form action={handleSend} className="mt-6 flex gap-2">
            <input
              name="body"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              placeholder={`Message ${theirDogName}'s owner`}
              className="flex-1 rounded border p-2"
            />
            <button
              type="submit"
              disabled={sending || draft.trim().length === 0}
              className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>
          <form
            action={async () => {
              await blockMatch(matchId)
            }}
            className="mt-4 border-t pt-4"
          >
            <button type="submit" className="text-sm text-gray-600 underline">
              Close this conversation
            </button>
          </form>
        </>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </>
  )
}
