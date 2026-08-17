import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import ReactivateForm from './ReactivateForm'
import { purgeDateFrom, PURGE_GRACE_DAYS } from '@/lib/validators/settings'
import { formatCalendarDate } from '@/lib/dates'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Restore your account',
  description: 'Your account is scheduled for deletion. Restore it, or let it go.',
  path: '/account/reactivate',
  index: false,
})

/**
 * Where a deactivated member lands when they sign in again.
 *
 * Deactivation does not touch Supabase auth, so they can still authenticate —
 * which is deliberate. Locking them out of their own recovery window would
 * make "you have 30 days to change your mind" untrue.
 */
export default async function ReactivatePage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: owner } = await supabase
    .from('owners')
    .select('display_name, deactivated_at')
    .eq('id', userData.user.id)
    .single()

  // Not deactivated: nothing to restore. Bounce rather than show a page that
  // offers to undo something that never happened.
  if (!owner?.deactivated_at) redirect('/home')

  const purgeOn = purgeDateFrom(new Date(owner.deactivated_at))

  return (
    <div className="mx-auto max-w-xl px-6 py-4">
      <SiteHeader variant="public" />

      <main className="mt-8">
        <h1 className="text-3xl font-bold">Your account is scheduled for deletion</h1>
        <p className="mt-4 text-ink-soft">
          You asked us to delete your account, so your profile and dogs are hidden from Forming
          Paws. Nothing is gone yet — we keep everything for {PURGE_GRACE_DAYS} days in case you
          change your mind.
        </p>

        <div className="fp-band mt-6">
          <p className="text-sm font-bold uppercase tracking-wide text-brand-dark">
            Permanent deletion
          </p>
          <p className="mt-1 font-display text-xl font-bold text-ink">
            {formatCalendarDate(purgeOn.toISOString().slice(0, 10))}
          </p>
        </div>

        <ReactivateForm />

        <p className="mt-8 text-sm text-ink-soft">
          Prefer to leave it? Do nothing and the account deletes itself on the date above. If you
          are part of a conversation someone has reported, deletion waits until our team has
          finished reviewing it.
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}
