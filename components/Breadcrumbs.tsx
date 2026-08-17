import Link from 'next/link'
import { absoluteUrl } from '@/lib/seo'

export type Crumb = { label: string; href?: string }

/**
 * Trail back to the front door, plus the matching structured data.
 *
 * The last crumb is the page you are on and is deliberately not a link — a link
 * to the page you are already reading is a small lie about what will happen.
 */
export default function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  const items = [{ label: 'Home', href: '/' }, ...trail]

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((item, i) => (
            <li key={item.label} className="flex items-center gap-1">
              {i > 0 && (
                <span aria-hidden="true" className="text-brand/30">
                  /
                </span>
              )}
              {item.href ? (
                <Link href={item.href} className="underline hover:text-ink-soft">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-ink-soft">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </>
  )
}
