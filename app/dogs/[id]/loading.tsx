import SageNote from '@/components/mascot/SageNote'

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <SageNote status mood="sleeping" title="Opening the profile…">
        Sage is fetching photos and health records.
      </SageNote>
    </div>
  )
}
