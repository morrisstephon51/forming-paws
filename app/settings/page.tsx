import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import LocationSettings from '../home/LocationSettings'
import { DisplayNameForm, EmailForm, NotificationForm, DangerZone } from './SettingsForms'
import { threadSummaries, totalUnread } from '@/lib/chat/threads'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Settings',
  description: 'Your profile, location, email, notifications and account.',
  path: '/settings',
  index: false,
})

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: owner } = await supabase
    .from('owners')
    .select(
      'display_name, location_label, deactivated_at, notify_matches, notify_messages, notify_health_reviews'
    )
    .eq('id', userData.user.id)
    .single()

  // A member mid-deletion has no business editing preferences they are about to
  // lose; send them to the one page that offers a way back.
  if (owner?.deactivated_at) redirect('/account/reactivate')

  const unreadTotal = totalUnread(await threadSummaries(supabase))

  return (
    <div className="mx-auto max-w-2xl px-6 py-4">
      <SiteHeader
        variant="member"
        pathname="/settings"
        unreadCount={unreadTotal}
        displayName={owner?.display_name ?? null}
      />

      <main className="mt-8">
        <h1 className="text-3xl font-bold">Settings</h1>

        <section aria-labelledby="profile" className="mt-8">
          <h2 id="profile" className="text-2xl font-bold">
            Profile
          </h2>
          <div className="fp-card mt-4">
            <DisplayNameForm current={owner?.display_name ?? ''} />
            <EmailForm current={userData.user.email ?? ''} />
          </div>
        </section>

        <section aria-labelledby="location" className="mt-10">
          <h2 id="location" className="text-2xl font-bold">
            Location
          </h2>
          <LocationSettings currentLabel={owner?.location_label ?? null} />
        </section>

        <section aria-labelledby="notifications" className="mt-10">
          <h2 id="notifications" className="text-2xl font-bold">
            Notifications
          </h2>
          <div className="fp-card mt-4">
            <NotificationForm
              matches={owner?.notify_matches ?? true}
              messages={owner?.notify_messages ?? true}
              healthReviews={owner?.notify_health_reviews ?? true}
            />
          </div>
        </section>

        <section aria-labelledby="account" className="mt-10">
          <h2 id="account" className="text-2xl font-bold">
            Account
          </h2>
          <DangerZone />
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
