import { ImageResponse } from 'next/og'
import { SITE_NAME } from '@/lib/site'

/**
 * Generated at request time rather than committed as a PNG, so the card stays
 * in sync with the wording and needs no binary in the repo.
 */
export const runtime = 'edge'
export const alt = `${SITE_NAME}: health-verified dog breeding matches`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #33685a 0%, #1f4238 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 34, opacity: 0.85 }}>🐾 {SITE_NAME}</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28 }}>
          <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.1 }}>Healthy matches.</div>
          <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.1, opacity: 0.82 }}>
            Happy litters.
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 30, marginTop: 36, opacity: 0.9 }}>
          Health-verified breeding matches for dog owners nearby
        </div>
      </div>
    ),
    size
  )
}
