export type UnreadMessage = {
  match_id: string
  sender_owner_id: string
  created_at: string
}

/**
 * Unread = sent by the other party, after my last read of this thread.
 *
 * A message stamped exactly at last_read_at counts as read. Opening a thread
 * stamps now(), so under a `>=` comparison the message that triggered the read
 * would stay unread forever.
 *
 * Postgres hands back ISO-8601 UTC strings, which compare correctly
 * lexicographically, so no Date parsing is needed.
 */
export function unreadCount(
  messages: UnreadMessage[],
  lastReadAt: string | null,
  myOwnerId: string
): number {
  return messages.filter(
    (m) => m.sender_owner_id !== myOwnerId && (lastReadAt === null || m.created_at > lastReadAt)
  ).length
}

export function unreadCountsByMatch(
  messages: UnreadMessage[],
  lastReadByMatch: Map<string, string>,
  myOwnerId: string
): Map<string, number> {
  const byMatch = new Map<string, UnreadMessage[]>()
  for (const m of messages) {
    const list = byMatch.get(m.match_id)
    if (list) list.push(m)
    else byMatch.set(m.match_id, [m])
  }

  const counts = new Map<string, number>()
  for (const [matchId, list] of byMatch) {
    counts.set(matchId, unreadCount(list, lastReadByMatch.get(matchId) ?? null, myOwnerId))
  }
  return counts
}
