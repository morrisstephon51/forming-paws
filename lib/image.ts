import sharp from 'sharp'

const MAX_DIMENSION = 2000

export async function stripImageMetadata(input: Buffer): Promise<Buffer> {
  const image = sharp(input)
    .rotate() // apply orientation from EXIF before stripping it, so the image isn't sideways
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })

  // Get metadata to extract dimensions
  const metadata = await image.metadata()

  // Extract raw pixel data and create new image without metadata
  const pixelData = await image.raw().toBuffer()

  return sharp(pixelData, {
    raw: {
      width: metadata.width!,
      height: metadata.height!,
      channels: metadata.channels!,
    },
  })
    .jpeg()
    .toBuffer()
}
