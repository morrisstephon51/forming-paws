'use client'

import { useTransition } from 'react'
import { reactivateAccount } from '@/app/settings/actions'

export default function ReactivateForm() {
  const [pending, start] = useTransition()

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => void reactivateAccount())}
        className="fp-btn"
      >
        {pending ? 'Restoring…' : 'Restore my account'}
      </button>
      {/*
        Signing out is the "leave it alone" path, and it must be a form POST —
        a GET link would let a prefetching browser take the decision for them.
      */}
      <form action="/auth/signout" method="post">
        <button type="submit" className="fp-btn-ghost">
          Leave it deleted
        </button>
      </form>
    </div>
  )
}
