import SageNote from '@/components/mascot/SageNote'

export default function Loading() {
  return (
    <div className="fp-shell py-16">
      <SageNote status mood="sleeping" title="Checking your matches…">
        Sage is reading the thread list.
      </SageNote>
    </div>
  )
}
