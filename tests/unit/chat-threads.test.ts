import { describe, it, expect, vi } from 'vitest'
import { threadSummaries, totalUnread } from '@/lib/chat/threads'
import type { SupabaseClient } from '@supabase/supabase-js'

function clientReturning(data: unknown) {
  return { rpc: vi.fn().mockResolvedValue({ data, error: null }) } as unknown as SupabaseClient
}

describe('threadSummaries', () => {
  it('reads the summaries straight from the database function', async () => {
    const supabase = clientReturning([
      { match_id: 'm1', unread: 2, last_body: 'hi', last_at: '2026-08-12T04:00:00Z' },
    ])

    const threads = await threadSummaries(supabase)

    expect(supabase.rpc).toHaveBeenCalledWith('match_thread_summaries')
    expect(threads).toEqual([
      { match_id: 'm1', unread: 2, last_body: 'hi', last_at: '2026-08-12T04:00:00Z' },
    ])
  })

  it('coerces a bigint that arrived as a string', async () => {
    // Postgres bigint can serialise as a string. Left as one, `+` concatenates
    // and a total of 2 renders as "11".
    const supabase = clientReturning([
      { match_id: 'm1', unread: '1', last_body: null, last_at: '2026-08-12T04:00:00Z' },
      { match_id: 'm2', unread: '1', last_body: null, last_at: '2026-08-12T05:00:00Z' },
    ])

    expect(totalUnread(await threadSummaries(supabase))).toBe(2)
  })

  it('treats no conversations as no unread', async () => {
    expect(totalUnread(await threadSummaries(clientReturning(null)))).toBe(0)
  })
})
