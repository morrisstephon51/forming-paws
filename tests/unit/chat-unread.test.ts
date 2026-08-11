import { describe, it, expect } from 'vitest'
import { unreadCount, unreadCountsByMatch, type UnreadMessage } from '@/lib/chat/unread'

const ME = 'me-owner-id'
const THEM = 'them-owner-id'

function msg(created_at: string, sender = THEM, match_id = 'm1'): UnreadMessage {
  return { match_id, sender_owner_id: sender, created_at }
}

describe('unreadCount', () => {
  it('counts everything from the other party when the thread was never opened', () => {
    expect(unreadCount([msg('2026-08-01T10:00:00Z'), msg('2026-08-01T11:00:00Z')], null, ME)).toBe(2)
  })

  it('never counts my own messages', () => {
    expect(
      unreadCount([msg('2026-08-01T10:00:00Z', ME), msg('2026-08-01T11:00:00Z', ME)], null, ME)
    ).toBe(0)
  })

  it('counts only messages after the last read', () => {
    const messages = [msg('2026-08-01T10:00:00Z'), msg('2026-08-01T12:00:00Z')]
    expect(unreadCount(messages, '2026-08-01T11:00:00Z', ME)).toBe(1)
  })

  it('treats a message stamped exactly at last_read_at as read', () => {
    expect(unreadCount([msg('2026-08-01T11:00:00Z')], '2026-08-01T11:00:00Z', ME)).toBe(0)
  })

  it('returns zero for an empty thread', () => {
    expect(unreadCount([], null, ME)).toBe(0)
  })
})

describe('unreadCountsByMatch', () => {
  it('groups per match and applies each match its own last-read', () => {
    const messages = [
      msg('2026-08-01T10:00:00Z', THEM, 'm1'),
      msg('2026-08-01T12:00:00Z', THEM, 'm1'),
      msg('2026-08-01T10:00:00Z', THEM, 'm2'),
      msg('2026-08-01T10:00:00Z', ME, 'm2'),
    ]
    const reads = new Map([['m1', '2026-08-01T11:00:00Z']])
    const result = unreadCountsByMatch(messages, reads, ME)
    expect(result.get('m1')).toBe(1)
    expect(result.get('m2')).toBe(1)
  })

  it('returns an empty map when there are no messages', () => {
    expect(unreadCountsByMatch([], new Map(), ME).size).toBe(0)
  })
})
