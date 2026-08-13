import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { stripImageMetadata, UnsupportedImageError } from '@/lib/image'

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

  it('applies EXIF orientation (rotation) before stripping metadata', async () => {
    // Create a rectangular (non-square) image so rotation is dimensionally detectable.
    // Unrotated raw pixel dimensions: 100x50 (width x height).
    // EXIF orientation 6 means "rotate 90deg CW to display correctly" — sharp's
    // .rotate() should physically rotate the pixels, swapping width/height.
    const withOrientation = await sharp({
      create: { width: 100, height: 50, channels: 3, background: { r: 0, g: 128, b: 255 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer()

    const stripped = await stripImageMetadata(withOrientation)
    const strippedMetadata = await sharp(stripped).metadata()

    // After applying orientation 6, the physical pixel dimensions should be swapped: 50x100.
    expect(strippedMetadata.width).toBe(50)
    expect(strippedMetadata.height).toBe(100)
    expect(strippedMetadata.exif).toBeUndefined()
  })

  it('resizes images larger than MAX_DIMENSION without throwing', async () => {
    const largeImage = await sharp({
      create: { width: 3000, height: 1500, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .jpeg()
      .toBuffer()

    const stripped = await stripImageMetadata(largeImage)
    const strippedMetadata = await sharp(stripped).metadata()

    expect(strippedMetadata.width).toBeLessThanOrEqual(2000)
    expect(strippedMetadata.height).toBeLessThanOrEqual(2000)
    expect(Math.max(strippedMetadata.width!, strippedMetadata.height!)).toBeLessThanOrEqual(2000)
  })

  it('rejects non-image bytes with a typed UnsupportedImageError', async () => {
    // A file that is not an image at all — what the upload route gets when someone
    // POSTs a text file or a spoofed content-type. sharp throws a generic Error
    // for this; stripImageMetadata must surface it as a typed, catchable error so
    // the route can answer 400 instead of a cryptic 500.
    const notAnImage = Buffer.from('this is plain text, not an image\n'.repeat(4))

    await expect(stripImageMetadata(notAnImage)).rejects.toBeInstanceOf(UnsupportedImageError)
  })

  it('preserves the original decode failure as the error cause', async () => {
    const notAnImage = Buffer.from('still not an image')

    const error = await stripImageMetadata(notAnImage).catch((e) => e)
    expect(error).toBeInstanceOf(UnsupportedImageError)
    expect((error as UnsupportedImageError).cause).toBeInstanceOf(Error)
  })
})
