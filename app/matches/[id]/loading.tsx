import SageNote from '@/components/mascot/SageNote'

/**
 * Without this file the parent app/matches/loading.tsx serves this route too,
 * and told the reader "Sage is reading the thread list" while opening a single
 * conversation. A nested loading.tsx takes precedence over its parent.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <SageNote status mood="sleeping" title="Opening the conversation…">
        Sage is fetching your messages.
      </SageNote>
    </div>
  )
}
