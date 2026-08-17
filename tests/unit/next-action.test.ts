import { describe, it, expect } from 'vitest'
import { nextAction, type HomeSummary } from '@/lib/home/nextAction'

const base: HomeSummary = {
  dogCount: 1,
  unverifiedDogs: [],
  hasLocation: true,
  unreadCount: 0,
}

describe('nextAction', () => {
  it('asks for a dog first when there are none', () => {
    expect(nextAction({ ...base, dogCount: 0 }).kind).toBe('add-dog')
  })

  it('asks for a dog even when other things are also undone', () => {
    const action = nextAction({
      dogCount: 0,
      unverifiedDogs: [],
      hasLocation: false,
      unreadCount: 9,
    })
    expect(action.kind).toBe('add-dog')
  })

  it('chases verification before unread messages', () => {
    const action = nextAction({ ...base, unverifiedDogs: [{ id: 'dog-1', name: 'Luna' }], unreadCount: 4 })
    expect(action.kind).toBe('verify-dog')
    expect(action.label).toContain('Luna')
  })

  it('names the first unverified dog when several are pending', () => {
    const action = nextAction({ ...base, unverifiedDogs: [{ id: 'dog-1', name: 'Luna' }, { id: 'dog-2', name: 'Bo' }] })
    expect(action).toMatchObject({ kind: 'verify-dog', dogName: 'Luna', href: '/dogs/dog-1' })
  })

  it('surfaces unread messages once every dog is verified', () => {
    const action = nextAction({ ...base, unreadCount: 2 })
    expect(action).toMatchObject({ kind: 'read-messages', count: 2, href: '/matches' })
  })

  it('uses the singular for exactly one unread message', () => {
    expect(nextAction({ ...base, unreadCount: 1 }).label).toBe('Read your message')
  })

  it('uses the plural for more than one', () => {
    expect(nextAction({ ...base, unreadCount: 2 }).label).toBe('Read your messages')
  })

  it('asks for a location when nothing is urgent', () => {
    expect(nextAction({ ...base, hasLocation: false }).kind).toBe('set-location')
  })

  it('falls through to browsing when everything is done', () => {
    expect(nextAction(base).kind).toBe('browse')
  })
})
