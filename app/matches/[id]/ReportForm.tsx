'use client'

import { useState } from 'react'
import { reportMatch } from './actions'

const REASONS: [string, string][] = [
  ['harassment', 'Harassment or abusive messages'],
  ['animal_welfare', 'Animal welfare concern'],
  ['suspected_fake_documents', 'Suspected fake health documents'],
  ['spam', 'Spam or advertising'],
  ['other', 'Something else'],
]

export default function ReportForm({ matchId }: { matchId: string }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (done) {
    return (
      <p className="mt-4 border-t pt-4 text-sm text-green-700">
        Thank you. A reviewer will read this conversation and follow up.
      </p>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 border-t pt-4 text-left text-sm text-ink-soft underline"
      >
        Report this conversation
      </button>
    )
  }

  return (
    <form
      action={async (formData: FormData) => {
        setError(null)
        try {
          await reportMatch(
            matchId,
            String(formData.get('reason')),
            String(formData.get('detail') ?? '')
          )
          setDone(true)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not send that report.')
        }
      }}
      className="mt-4 flex flex-col gap-3 border-t pt-4"
    >
      <p className="text-sm text-ink-soft">
        Reporting lets a Forming Paws reviewer read this conversation while they look into it.
      </p>
      <select name="reason" required className="fp-input text-sm">
        <option value="">Choose a reason…</option>
        {REASONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <textarea
        name="detail"
        maxLength={1000}
        placeholder="Anything else we should know (optional)"
        className="fp-input text-sm"
      />
      <div className="flex items-center gap-3">
        <button type="submit" className="fp-btn px-4 py-2 text-sm">
          Send report
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-ink-soft underline"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
