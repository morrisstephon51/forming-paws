import type { ReactNode } from 'react'

/**
 * The four "how it works" steps as a stacked deck on desktop.
 *
 * This is the one place on the site where a sticky stack earns itself: the
 * steps are strictly sequential — profile, records, match, meet — and pinning
 * each one while the next slides up over it says "these happen in order" far
 * better than four equal cards in a row. Applied to the roadmap or the health
 * principles it would be decoration, because neither is a sequence.
 *
 * No JavaScript at all. `position: sticky` plus a scroll runway per card does
 * the whole effect, which means it costs nothing on the main thread, degrades to
 * a plain list wherever sticky is unsupported, and cannot drop a frame.
 *
 * Below `md` it *is* a plain list, on purpose. Four pinned cards on a phone is
 * four screens of scrolling to read what a single column shows at once — a worse
 * page wearing a richer page's clothes.
 *
 * The `<ol>` and `<li>` are kept exactly as they were. The stack is a visual
 * treatment of an ordered list, and it still has to read as one to a screen
 * reader.
 */
export default function StepStack({
  items,
}: {
  items: { key: string | number; children: ReactNode }[]
}) {
  return (
    <ol className="mt-6 flex flex-col gap-4 md:mt-8 md:block md:max-w-3xl md:gap-0">
      {items.map((item, i) => (
        <li
          key={item.key}
          className="fp-sticky-card"
          style={{
            // Each card pins a little lower than the one before it, so the deck
            // keeps a visible edge of every card underneath rather than burying
            // them. z-index climbs in step so later cards ride over earlier ones.
            top: `calc(6.5rem + ${i * 1.15}rem)`,
            zIndex: i + 1,
          }}
        >
          {item.children}
        </li>
      ))}
    </ol>
  )
}
