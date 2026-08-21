import Image, { type StaticImageData } from 'next/image'

/**
 * A page-header illustration band.
 *
 * One component for every banner on the site so they cannot drift apart: same
 * aspect ratio, same rounding, same loading behaviour, same decorative
 * semantics. Adding a banner to a page is one import and one line.
 *
 * The fixed aspect box is what keeps CLS at zero. The image is `fill` inside a
 * container whose height is derived from its own width, so the space is
 * reserved before a single byte of the image arrives.
 *
 * `priority` is opt-in per call site, and it exists because the original claim
 * here — "these all sit below the fold on every page that uses them" — was
 * false. Measured against the shipped build, the banner is inside the initial
 * viewport on every page that renders one, at both widths tested:
 *
 *   /education/[slug]   top 148px @1440   top 260px @375
 *   /education          top 280px @1440   top 416px @375
 *   /about              top 302px @1440   top 344px @375
 *
 * So the largest above-the-fold image on three pages was being lazy-loaded,
 * which is the one thing lazy loading must never be applied to. Pages that
 * render the banner above the fold pass `priority`; any that place it lower
 * should not.
 */
export default function BannerArt({
  src,
  className = '',
  priority = false,
}: {
  src: StaticImageData
  className?: string
  /** Set on call sites where the banner is inside the initial viewport. */
  priority?: boolean
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative aspect-[21/9] w-full overflow-hidden rounded-2xl border border-brand/10 ${className}`}
    >
      <Image
        src={src}
        alt=""
        fill
        {...(priority ? { priority: true as const } : { loading: "lazy" as const })}
        placeholder="blur"
        sizes="(max-width: 768px) 100vw, 768px"
        className="object-cover"
      />
    </div>
  )
}
