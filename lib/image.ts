import sharp from 'sharp'

const MAX_DIMENSION = 2000

/**
 * The bytes handed in were not an image sharp could decode: a corrupt file, a
 * content-type that lied, or a format this sharp build was not compiled for
 * (HEIC/AVIF). Callers turn this into a 400 the uploader can act on, instead of
 * letting sharp's raw throw bubble up as a 500 on the upload endpoint.
 */
export class UnsupportedImageError extends Error {
  constructor(cause?: unknown) {
    super('The file is not a readable image', { cause })
    this.name = 'UnsupportedImageError'
  }
}

export async function stripImageMetadata(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input)
      .rotate() // apply orientation from EXIF before stripping it, so the image isn't sideways
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg()
      .toBuffer()
  } catch (cause) {
    // sharp throws a generic Error ("Input buffer contains unsupported image
    // format") for anything it cannot decode. Re-throw as a typed error so the
    // route can distinguish "user sent a bad file" (400) from a real failure.
    throw new UnsupportedImageError(cause)
  }
}
