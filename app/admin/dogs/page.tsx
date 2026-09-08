import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/roles'
import { pageMetadata } from '@/lib/seo'
import {
  updateDogAction,
  removeDogAction,
  restoreDogAction,
  reassignDogAction,
} from './actions'

export const metadata = pageMetadata({
  title: 'Dogs',
  description: 'Manage member dogs.',
  path: '/admin/dogs',
  index: false,
})

const FIELD = 'mt-1 w-full rounded border border-hairline px-2 py-1 text-sm'
const BTN = 'rounded border border-hairline px-2 py-1 text-sm'

export default async function AdminDogsPage() {
  await requireRole('admin')
  const supabase = await createClient()

  // dogs_select_admin is deliberately unfiltered, so removed dogs appear here
  // and nowhere else. That is what makes restore possible.
  const { data: dogs } = await supabase
    .from('dogs')
    .select('id, name, sex, birth_date, weight_lbs, temperament_notes, breed_id, litter_id, listed_price_cents, owner_id, removed_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: breeds } = await supabase.from('breeds').select('id, name').order('name')
  const { data: owners } = await supabase
    .from('owners')
    .select('id, display_name')
    .order('display_name')
    .limit(500)

  const ownerName = new Map((owners ?? []).map((o) => [o.id, o.display_name]))

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="fp-h2">Dogs</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Removing a dog hides it from browse, matching and its owner&rsquo;s own list. Its health
        documents, photos and message threads are preserved and it can be restored.
      </p>

      {(dogs ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">No dogs yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {(dogs ?? []).map((dog) => (
            <li key={dog.id} className="rounded border border-hairline p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{dog.name}</p>
                <p className="text-xs text-ink-soft">
                  {dog.removed_at ? `Removed ${new Date(dog.removed_at).toLocaleDateString()}` : 'Active'}
                </p>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                Owner: {ownerName.get(dog.owner_id) ?? dog.owner_id}
              </p>

              <form action={updateDogAction} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="dogId" value={dog.id} />
                <label className="text-xs text-ink-soft">
                  Name
                  <input name="name" defaultValue={dog.name} className={FIELD} required />
                </label>
                <label className="text-xs text-ink-soft">
                  Breed
                  <select name="breedId" defaultValue={String(dog.breed_id)} className={FIELD}>
                    {(breeds ?? []).map((b) => (
                      <option key={b.id} value={String(b.id)}>{b.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-ink-soft">
                  Sex
                  <select name="sex" defaultValue={dog.sex} className={FIELD}>
                    <option value="male">male</option>
                    <option value="female">female</option>
                  </select>
                </label>
                <label className="text-xs text-ink-soft">
                  Birth date
                  <input type="date" name="birthDate" defaultValue={dog.birth_date} className={FIELD} required />
                </label>
                <label className="text-xs text-ink-soft">
                  Weight (lbs)
                  <input name="weightLbs" defaultValue={dog.weight_lbs ?? ''} className={FIELD} />
                </label>
                <label className="text-xs text-ink-soft">
                  Temperament notes
                  <textarea name="temperamentNotes" defaultValue={dog.temperament_notes ?? ''} className={FIELD} rows={2} />
                </label>
                <label className="text-xs text-ink-soft">
                  Listed price (cents) — clear to pull from the marketplace
                  <input name="listedPriceCents" defaultValue={dog.listed_price_cents ?? ''} className={FIELD} />
                </label>
                <button type="submit" className={BTN}>Save changes</button>
              </form>

              <form action={reassignDogAction} className="mt-3 flex flex-col gap-2 border-t border-hairline pt-3">
                <input type="hidden" name="dogId" value={dog.id} />
                <input type="hidden" name="dogName" value={dog.name} />
                <input type="hidden" name="previousOwnerId" value={dog.owner_id} />
                <label className="text-xs text-ink-soft">
                  Reassign to
                  <select name="newOwnerId" defaultValue={dog.owner_id} className={FIELD}>
                    {(owners ?? []).map((o) => (
                      <option key={o.id} value={o.id}>{o.display_name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-ink-soft">
                  Type <strong>{dog.name}</strong> to confirm — this moves photos and health documents
                  <input name="confirmName" className={FIELD} />
                </label>
                <button type="submit" className={BTN}>Reassign owner</button>
              </form>

              {dog.removed_at ? (
                <form action={restoreDogAction} className="mt-3 border-t border-hairline pt-3">
                  <input type="hidden" name="dogId" value={dog.id} />
                  <button type="submit" className={BTN}>Restore</button>
                </form>
              ) : (
                <form action={removeDogAction} className="mt-3 flex flex-col gap-2 border-t border-hairline pt-3">
                  <input type="hidden" name="dogId" value={dog.id} />
                  <label className="text-xs text-ink-soft">
                    Reason
                    <input name="reason" className={FIELD} />
                  </label>
                  <button type="submit" className={BTN}>Remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
