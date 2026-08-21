import SageNote from '@/components/mascot/SageNote'

/**
 * Browse reads the dog list,each owner's photos and the distance filter before it
 * can render anything, so there was a visible gap where the page simply sat on
 * the previous route. This is that gap, given a face.
 */
export default function Loading() {
  return (
    <div className="fp-shell py-16">
      <SageNote status mood="sleeping" title="Fetching dogs nearby…">
        Sage is rounding them up.
      </SageNote>
    </div>
  )
}
