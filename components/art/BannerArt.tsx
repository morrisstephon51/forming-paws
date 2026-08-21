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
 * No `priority` here, deliberately, and no prop to opt into it: these all sit
 * below the fold on every page that uses them, and the hero is the only image
 * on the site that should ever preload.
 */
export default function BannerArt({
  src,
  className = '',
}: {
  src: StaticImageData
  className?: string
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
        loading="lazy"
        placeholder="blur"
        sizes="(max-width: 768px) 100vw, 768px"
        className="object-cover"
      />
    </div>
  )
}
