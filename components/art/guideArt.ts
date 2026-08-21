import type { StaticImageData } from 'next/image'
import documents from '@/assets/art/guide-documents.jpg'
import vet from '@/assets/art/guide-vet.jpg'
import meeting from '@/assets/art/guide-meeting.jpg'

/**
 * Guide slug to header illustration.
 *
 * Deliberately a lookup that can miss rather than a required field on the Guide
 * type: a new guide should be publishable the moment its words are ready, and
 * ship without a banner until one exists. Callers render nothing on a miss.
 */
const GUIDE_ART: Record<string, StaticImageData> = {
  'health-documents': documents,
  'questions-for-your-vet': vet,
  'meeting-safely': meeting,
}

export function guideArt(slug: string): StaticImageData | undefined {
  return GUIDE_ART[slug]
}
