'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import {
  updateDisplayName,
  updateNotifications,
  requestEmailChange,
  deactivateAccount,
  type ActionResult,
} from './actions'
import { DELETE_CONFIRMATION, PURGE_GRACE_DAYS } from '@/lib/validators/settings'

const EMPTY: ActionResult = { ok: false, message: '' }

function Notice({ result }: { result: ActionResult }) {
  if (!result.message) return null
  return (
    <p className={`mt-3 text-sm ${result.ok ? 'text-brand-dark' : 'text-red-700'}`} role="status">
      {result.message}
    </p>
  )
}

const inputClass =
  'w-full rounded-lg border border-brand/25 bg-white p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand'

export function DisplayNameForm({ current }: { current: string }) {
  const [result, action, pending] = useActionState(updateDisplayName, EMPTY)
  return (
    <form action={action} className="mt-4">
      <label htmlFor="display_name" className="text-sm font-bold">
        Your name
      </label>
      <p className="mb-2 text-sm text-ink-soft">Shown to owners you match with.</p>
      <div className="flex flex-wrap gap-2">
        <input
          id="display_name"
          name="display_name"
          defaultValue={current}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button type="submit" disabled={pending} className="fp-btn px-4 py-2 text-sm">
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
      <Notice result={result} />
    </form>
  )
}

export function EmailForm({ current }: { current: string }) {
  const [result, action, pending] = useActionState(requestEmailChange, EMPTY)
  return (
    <form action={action} className="mt-6">
      <label htmlFor="email" className="text-sm font-bold">
        Email address
      </label>
      <p className="mb-2 text-sm text-ink-soft">
        Currently {current}. Changing it needs confirmation from both the old and the new address.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={current}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button type="submit" disabled={pending} className="fp-btn px-4 py-2 text-sm">
          {pending ? 'Sending…' : 'Change email'}
        </button>
      </div>
      <Notice result={result} />
    </form>
  )
}

export function NotificationForm({
  matches,
  messages,
  healthReviews,
}: {
  matches: boolean
  messages: boolean
  healthReviews: boolean
}) {
  const [result, action, pending] = useActionState(updateNotifications, EMPTY)
  const rows = [
    { name: 'notify_matches', label: 'When a dog matches with mine', checked: matches },
    { name: 'notify_messages', label: 'When I get a new message', checked: messages },
    {
      name: 'notify_health_reviews',
      label: 'When a health document is reviewed',
      checked: healthReviews,
    },
  ]

  return (
    <form action={action} className="mt-4">
      {/*
        Said plainly rather than quietly omitted. Nothing sends email yet, and a
        member who switches one of these off would otherwise believe they had
        changed something they had not.
      */}
      <p className="fp-badge mb-4 !bg-accent-soft !text-accent-dark">
        Email notifications aren&apos;t sending yet — we&apos;ll use these the moment they are.
      </p>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <label key={row.name} className="flex items-center gap-3 text-sm">
            <input type="checkbox" name={row.name} defaultChecked={row.checked} className="h-4 w-4" />
            {row.label}
          </label>
        ))}
      </div>
      <button type="submit" disabled={pending} className="fp-btn mt-4 px-4 py-2 text-sm">
        {pending ? 'Saving…' : 'Save preferences'}
      </button>
      <Notice result={result} />
    </form>
  )
}

export function DangerZone() {
  const [result, action, pending] = useActionState(deactivateAccount, EMPTY)
  return (
    <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 p-5">
      <h3 className="font-display text-lg font-bold text-ink">Delete your account</h3>
      <p className="mt-2 text-sm text-ink-soft">
        Your profile and dogs disappear from Forming Paws straight away. We keep the record for{' '}
        {PURGE_GRACE_DAYS} days so you can change your mind, then it is permanently deleted.
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        If you are part of a conversation someone has reported, deletion waits until our team has
        finished reviewing it.
      </p>

      <form action={action} className="mt-4">
        <label htmlFor="confirmation" className="text-sm font-bold">
          Type “{DELETE_CONFIRMATION}” to confirm
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id="confirmation"
            name="confirmation"
            autoComplete="off"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <button
            type="submit"
            disabled={pending}
            className="whitespace-nowrap rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          >
            {pending ? 'Working…' : 'Delete account'}
          </button>
        </div>
        <Notice result={result} />
      </form>

      <form action="/auth/signout" method="post" className="mt-6 border-t border-red-200 pt-4">
        <p className="text-sm text-ink-soft">Just want to step away for now?</p>
        <button type="submit" className="fp-btn-ghost mt-2 px-4 py-2 text-sm">
          Sign out
        </button>
      </form>

      <p className="mt-4 text-sm text-ink-soft">
        Changing your password instead?{' '}
        <Link href="/account/password" className="fp-link">
          Do that here
        </Link>
        .
      </p>
    </div>
  )
}
