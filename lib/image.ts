import sharp from 'sharp'

const MAX_DIMENSION = 2000

export async function stripImageMetadata(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // apply orientation from EXIF before stripping it, so the image isn't sideways
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .jpeg()
    .toBuffer()
}
