import Link from 'next/link'
import { requireRole } from '@/lib/auth/roles'

/**
 * Section nav for the console. The gate here is the outer one; each page keeps
 * its own requireRole call so a route reached outside this layout is still
 * protected. Width and padding stay with the pages, which already set their
 * own <main> — the nav just matches the widest of them.
 */
const NAV = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/review-queue', label: 'Review queue' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/messages', label: 'Messages' },
  { href: '/admin/audit-log', label: 'Audit log' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('admin')

  return (
    <>
      <div className="mx-auto max-w-4xl px-8 pt-8">
        <p className="fp-eyebrow">Administration</p>
        <nav aria-label="Admin sections" className="mt-2 flex flex-wrap gap-4 border-b border-hairline pb-3">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-ink-soft underline-offset-4 hover:underline">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </>
  )
}
