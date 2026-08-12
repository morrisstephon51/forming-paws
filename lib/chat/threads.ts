import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * One row per conversation this member is in: how many messages they have not
 * read, and the latest message for the list preview.
 *
 * Counted by `match_thread_summaries()` in Postgres rather than in the app. The
 * app used to pull every message row it could see and count in TypeScript, and
 * PostgREST caps a response at 1000 rows — so past a thousand messages the badge
 * would have quietly started under-reporting with nothing to show for it.
 */
export type ThreadSummary = {
  match_id: string
  unread: number
  last_body: string | null
  last_at: string
}

export async function threadSummaries(supabase: SupabaseClient): Promise<ThreadSummary[]> {
  const { data } = await supabase.rpc('match_thread_summaries')

  // Postgres bigint can arrive as a string; a string would make `+` concatenate
  // and turn a total of 2 into "11".
  return ((data ?? []) as ThreadSummary[]).map((row) => ({
    ...row,
    unread: Number(row.unread),
  }))
}

export function totalUnread(threads: ThreadSummary[]): number {
  return threads.reduce((sum, thread) => sum + thread.unread, 0)
}
