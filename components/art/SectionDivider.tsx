/**
 * A soft organic band that separates two full-width sections.
 *
 * Hand-drawn rather than generated: it is two paths and about 700 bytes, it
 * inherits the brand palette exactly instead of approximately, and it scales to
 * any width without a second asset. A raster here would have cost forty
 * kilobytes to do less.
 */
export default function SectionDivider({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`w-full ${className}`}>
      <svg
        viewBox="0 0 1440 96"
        preserveAspectRatio="none"
        className="h-16 w-full sm:h-24"
        fill="none"
      >
        <path
          d="M0 52 C 200 20, 380 74, 600 50 C 820 26, 980 76, 1200 54 C 1320 42, 1390 58, 1440 50 L1440 96 L0 96 Z"
          fill="#E3EFE9"
        />
        <path
          d="M0 70 C 220 44, 400 90, 640 68 C 880 46, 1040 92, 1260 72 C 1360 63, 1410 74, 1440 70 L1440 96 L0 96 Z"
          fill="#2F6B5C"
          fillOpacity="0.14"
        />
      </svg>
    </div>
  )
}
