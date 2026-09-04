import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { pageMetadata } from '@/lib/seo'
import { formatCalendarDate } from '@/lib/dates'
import AddPuppyForm from './AddPuppyForm'

export const metadata = pageMetadata({
  title: 'Manage litter',
  description: 'Add puppies to a litter and see who has reached out.',
  path: '/litters/[id]',
  index: false,
})

export default async function LitterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  // litters_select_own restricts this to the caller's own litter already --
  // a non-owner's request for someone else's litter id returns no row, not
  // an error, so it 404s exactly like a real missing id would.
  const { data: litter, error } = await supabase
    .from('litters')
    .select('id, breeder_id, sire_id, dam_id, born_on, ready_on, sire:dogs!litters_sire_id_fkey(name), dam:dogs!litters_dam_id_fkey(name)')
    .eq('id', id)
    .maybeSingle()

  if (error || !litter) notFound()

  const { data: puppies } = await supabase
    .from('dogs')
    .select('id, name, sex, birth_date, listed_price_cents')
    .eq('litter_id', id)
    .order('created_at')

  const puppyIds = (puppies ?? []).map((p) => p.id)
  const { data: inquiries } = puppyIds.length
    ? await supabase
        .from('puppy_inquiries')
        .select('id, puppy_id, buyer_email, message, created_at')
        .in('puppy_id', puppyIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const sire = litter.sire as unknown as { name: string } | null
  const dam = litter.dam as unknown as { name: string } | null

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="fp-h2">
        {sire?.name} × {dam?.name}
      </h1>
      <p className="text-ink-soft">
        {litter.born_on ? `Born ${formatCalendarDate(litter.born_on)}` : 'Birth date not set'}
        {litter.ready_on ? ` · ready ${formatCalendarDate(litter.ready_on)}` : ''}
      </p>

      <section className="mt-8">
        <h2 className="fp-h4">Puppies</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {(puppies ?? []).map((puppy) => (
            <li key={puppy.id} className="fp-card flex items-center justify-between">
              <span>
                {puppy.name} · {puppy.sex}, born {formatCalendarDate(puppy.birth_date)}
              </span>
              <span className="text-sm text-ink-soft">
                {puppy.listed_price_cents != null
                  ? `$${(puppy.listed_price_cents / 100).toLocaleString()}`
                  : 'No price shown'}
              </span>
            </li>
          ))}
          {(puppies ?? []).length === 0 && (
            <li className="text-sm text-ink-soft">No puppies added yet.</li>
          )}
        </ul>
        <AddPuppyForm litterId={id} defaultBirthDate={litter.born_on} />
      </section>

      <section className="mt-10">
        <h2 className="fp-h4">Inquiries</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {(inquiries ?? []).map((inquiry) => {
            const puppy = (puppies ?? []).find((p) => p.id === inquiry.puppy_id)
            return (
              <li key={inquiry.id} className="fp-card">
                <p className="font-medium">
                  About {puppy?.name ?? 'a puppy'} ·{' '}
                  <a href={`mailto:${inquiry.buyer_email}`} className="text-brand underline">
                    {inquiry.buyer_email}
                  </a>
                </p>
                <p className="mt-1 text-sm text-ink-soft">{inquiry.message}</p>
              </li>
            )
          })}
          {(inquiries ?? []).length === 0 && (
            <li className="text-sm text-ink-soft">No inquiries yet.</li>
          )}
        </ul>
      </section>
    </main>
  )
}
