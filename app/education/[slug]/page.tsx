import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteFooter from '@/components/SiteFooter'
import Breadcrumbs from '@/components/Breadcrumbs'
import { GUIDES, guideBySlug } from '@/lib/education'
import { pageMetadata } from '@/lib/seo'
import BannerArt from '@/components/art/BannerArt'
import { guideArt } from '@/components/art/guideArt'

/**
 * The disclaimer each notice type carries. Kept as data beside the page that
 * renders it: "not veterinary advice" is the wrong sentence on a page about the
 * Animal Welfare Act, and one vague notice covering both would blunt each.
 */
const NOTICE = {
  vet: {
    title: 'Not veterinary advice.',
    body: 'Nothing here was written or reviewed by a veterinarian. Talk to yours.',
  },
  legal: {
    title: 'Not legal advice.',
    body: 'This is a plain-language map of rules that change, written by people who are not lawyers. Read the sources, and take anything that matters to someone who is.',
  },
} as const

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

  const art = guideArt(guide.slug)

  return (
    <div className="mx-auto max-w-2xl px-6 py-4">

      <main className="mt-6">
        {/* Breadcrumbs prepends Home itself, and leaves the last crumb unlinked. */}
        <Breadcrumbs trail={[{ label: 'Learn', href: '/education' }, { label: guide.title }]} />

        {art && <BannerArt priority src={art} className="mt-4" />}

        <h1 className="mt-6 fp-h1">{guide.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">{guide.readingMinutes} min read</p>
        <p className="mt-4 text-ink-soft">{guide.summary}</p>

        <p className="fp-card mt-6 border-l-4 border-l-accent text-sm text-ink-soft">
          <strong className="text-ink">{NOTICE[guide.notice].title}</strong>{' '}
          {NOTICE[guide.notice].body}
        </p>

        <article className="mt-8 flex flex-col gap-8">
          {guide.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="fp-h4">{section.heading}</h2>
              <div className="mt-3 flex flex-col gap-3 text-ink-soft">
                {section.body.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          ))}
        </article>

        {/*
          Sources are part of the page, not a footnote for the diligent. A guide
          that tells an owner what a statute requires has to show the statute, or
          it is asking to be taken on trust about the one thing it cannot be.
        */}
        {guide.sources && guide.sources.length > 0 && (
          <section aria-labelledby="sources" className="fp-hairline mt-12 pt-6">
            <h2 id="sources" className="fp-h4">
              Sources
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Everything above rests on these. They are linked so you can check them rather than
              take our word for it.
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {guide.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    className="fp-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav aria-label="More guides" className="fp-band mt-12">
          <h2 className="fp-h4">Keep reading</h2>
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
