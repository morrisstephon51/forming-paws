import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { stripImageMetadata } from '@/lib/image'

describe('stripImageMetadata', () => {
  it('removes EXIF metadata from a JPEG buffer', async () => {
    const withExif = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .withMetadata({ exif: { IFD0: { Make: 'TestCamera' } } })
      .jpeg()
      .toBuffer()

    const stripped = await stripImageMetadata(withExif)
    const strippedMetadata = await sharp(stripped).metadata()

    expect(strippedMetadata.exif).toBeUndefined()
  })
})
