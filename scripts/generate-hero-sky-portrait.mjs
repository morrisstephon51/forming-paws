/**
 * Generates assets/art/hero-sky-portrait.jpg.
 *
 * The landscape panorama (hero-sky.jpg, 2560x695) is the wrong shape for the
 * splash on a phone. The splash box is roughly 390x716 there, and `object-cover`
 * on a 3.68:1 source has to scale by *height* to fill it — drawing the bitmap
 * about 2820 CSS px wide inside a 390px window. The visitor sees a ~14% slice
 * blown up ~7x, and no `sizes` value fixes that: the honest ones ask for a
 * 5000px-wide image on a phone, and the cheap ones are what we already had.
 *
 * So this is art direction, not a hint change. 1200x2200 is sized from the box
 * it has to fill: at 390x716 `cover` scales by width instead (430x788 drawn, a
 * 10% overdraw rather than 700%), and 1200 is a real Next device size, so the
 * candidate a phone picks at DPR3 is served at close to 1:1.
 *
 * Every colour is sampled from the panorama rather than chosen, so the two
 * files are the same sky: #FBBB98 in the hot corner through #FAF1E8 at the far
 * end, #E3EAE3 and #FDF4ED for the two cloud fills. The composition is turned
 * upright — warm overhead, pale toward the horizon where the hills meet it —
 * because the vertical slice a phone actually sees of the panorama is the pale
 * middle, with the sunrise cropped off the left-hand edge.
 *
 * Run: node scripts/generate-hero-sky-portrait.mjs
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'art', 'hero-sky-portrait.jpg')

const W = 1200
const H = 2200

const TEAL = '#E3EAE3'
const CREAM = '#FDF4ED'

/**
 * A cloud in the panorama's vocabulary: overlapping circles on a hard flat
 * baseline, no outline and no shading. Drawn as a union of opaque shapes in one
 * group, which is what gives the crisp silhouette the flat style depends on.
 */
function cloud({ x, baseline, scale = 1, fill, flip = false }) {
  // Every dome sits *on* the baseline (cy = baseline - r), which is what makes
  // the bottom edge a single hard line the way the panorama's clouds do. The
  // slab is only as tall as the smallest dome, so the silhouette scallops
  // between them instead of reading as a box with a bump on it.
  // Spacing is solved, not eyeballed: where two domes meet they cut a cusp, and
  // the cusp has to land *below* the slab line or a spike of sky shows through
  // it. The first pass had two of those. These four intersect at 0, 12.6 and
  // 16.9 units above the baseline, all under the 26-unit slab.
  const domes = [
    [40, 30],
    [96, 58],
    [162, 42],
    [220, 26],
  ]
  const SLAB = 26
  const LEFT_EDGE = 10
  const RIGHT_EDGE = 246
  const MIRROR = LEFT_EDGE + RIGHT_EDGE
  const at = (dx) => x + (flip ? MIRROR - dx : dx) * scale
  const circles = domes
    .map(([dx, r]) => {
      const cy = baseline - r * scale
      return `<circle cx="${at(dx).toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * scale).toFixed(1)}"/>`
    })
    .join('')
  const left = x + LEFT_EDGE * scale
  const right = x + RIGHT_EDGE * scale
  const top = baseline - SLAB * scale
  return `<g fill="${fill}">${circles}<rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${(right - left).toFixed(1)}" height="${(baseline - top).toFixed(1)}"/></g>`
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="${W}" y2="${H * 0.82}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FBBB98"/>
      <stop offset="0.28" stop-color="#FCD2BA"/>
      <stop offset="0.55" stop-color="#FCE6D8"/>
      <stop offset="0.78" stop-color="#FBF0E4"/>
      <stop offset="1" stop-color="#FAF1E8"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${cloud({ x: 150, baseline: 950, scale: 1.25, fill: CREAM })}
  ${cloud({ x: 585, baseline: 1215, scale: 1.55, fill: TEAL, flip: true })}
  ${cloud({ x: -120, baseline: 1655, scale: 1.35, fill: CREAM })}
  ${cloud({ x: 760, baseline: 1905, scale: 1.7, fill: TEAL })}
</svg>`

// Grain, for the same reason the panorama has it: a 2200px gradient across this
// narrow a value range bands badly on 8-bit without it. Measured sigma in a flat
// patch of the original is ~1.2 levels, so this matches rather than invents.
const noise = sharp({
  create: { width: W, height: H, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 2.4 } },
})

const base = await sharp(Buffer.from(svg)).png().toBuffer()
const grain = await noise.png().toBuffer()

await sharp(base)
  .composite([{ input: grain, blend: 'overlay' }])
  .jpeg({ quality: 88, progressive: true, chromaSubsampling: '4:4:4' })
  .toFile(OUT)

const meta = await sharp(OUT).metadata()
console.log(`wrote ${OUT} — ${meta.width}x${meta.height}, ${(meta.size / 1024).toFixed(1)}KB`)
