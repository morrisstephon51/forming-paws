import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteFooter from '@/components/SiteFooter'
import Breadcrumbs from '@/components/Breadcrumbs'
import { GUIDES, guideBySlug } from '@/lib/education'
import { pageMetadata } from '@/lib/seo'

/** Static params so each guide prerenders and is crawlable as its own URL. */
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = guideBySlug(slug)
  if (!guide) return pageMetadata({ title: 'Guide', description: '', path: '/education' })

  return pageMetadata({
    title: guide.title,
    description: guide.summary,
    path: `/education/${guide.slug}`,
  })
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = guideBySlug(slug)
  if (!guide) notFound()

  return (
    <div className="mx-auto max-w-2xl px-6 py-4">

      <main className="mt-6">
        {/* Breadcrumbs prepends Home itself, and leaves the last crumb unlinked. */}
        <Breadcrumbs trail={[{ label: 'Learn', href: '/education' }, { label: guide.title }]} />

        <h1 className="mt-4 text-3xl font-bold leading-tight">{guide.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">{guide.readingMinutes} min read</p>
        <p className="mt-4 text-ink-soft">{guide.summary}</p>

        <p className="fp-card mt-6 border-l-4 border-l-accent text-sm text-ink-soft">
          <strong className="text-ink">Not veterinary advice.</strong> Nothing here was written or
          reviewed by a veterinarian. Talk to yours.
        </p>

        <article className="mt-8 flex flex-col gap-8">
          {guide.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-bold">{section.heading}</h2>
              <div className="mt-3 flex flex-col gap-3 text-ink-soft">
                {section.body.map((para) => (
                  <p key={para.slice(0, 40)}>{para}</p>
                ))}
              </div>
            </section>
          ))}
        </article>

        <nav aria-label="More guides" className="fp-band mt-12">
          <h2 className="text-xl font-bold">Keep reading</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {GUIDES.filter((g) => g.slug !== guide.slug).map((g) => (
              <li key={g.slug}>
                <Link href={`/education/${g.slug}`} className="fp-link">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/education" className="fp-btn-ghost mt-5">
            All guides
          </Link>
        </nav>
      </main>

      <SiteFooter />
    </div>
  )
}
