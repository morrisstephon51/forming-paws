// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { createResilientFetch } from '@/lib/supabase/fetch'

const REST_URL = 'https://example.supabase.co/rest/v1/dogs'
const ok = () => new Response('[]', { status: 200 })
const withStatus = (status: number) => new Response('', { status })

/** A fetch that never answers until its signal aborts, like the stalled gateway. */
function stalled() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      }),
  )
}

describe('createResilientFetch', () => {
  it('returns a successful read without retrying', async () => {
    const base = vi.fn(async () => ok())
    const res = await createResilientFetch(base, { retryDelayMs: 0 })(REST_URL)
    expect(res.status).toBe(200)
    expect(base).toHaveBeenCalledTimes(1)
  })

  it('retries a read once when the gateway answers 504', async () => {
    const base = vi.fn().mockResolvedValueOnce(withStatus(504)).mockResolvedValueOnce(ok())
    const res = await createResilientFetch(base, { retryDelayMs: 0 })(REST_URL, { method: 'GET' })
    expect(res.status).toBe(200)
    expect(base).toHaveBeenCalledTimes(2)
  })

  it('retries only once, then returns what the second attempt got', async () => {
    const base = vi.fn(async () => withStatus(503))
    const res = await createResilientFetch(base, { retryDelayMs: 0 })(REST_URL)
    expect(res.status).toBe(503)
    expect(base).toHaveBeenCalledTimes(2)
  })

  it('never retries a write or an RPC', async () => {
    const base = vi.fn(async () => withStatus(504))
    const res = await createResilientFetch(base, { retryDelayMs: 0 })(REST_URL, { method: 'POST', body: '{}' })
    expect(res.status).toBe(504)
    expect(base).toHaveBeenCalledTimes(1)
  })

  it('does not retry an answer that is not a gateway failure', async () => {
    const base = vi.fn(async () => withStatus(401))
    const res = await createResilientFetch(base, { retryDelayMs: 0 })(REST_URL)
    expect(res.status).toBe(401)
    expect(base).toHaveBeenCalledTimes(1)
  })

  it('retries a read after a network failure', async () => {
    const base = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(ok())
    const res = await createResilientFetch(base, { retryDelayMs: 0 })(REST_URL)
    expect(res.status).toBe(200)
    expect(base).toHaveBeenCalledTimes(2)
  })

  it('does not retry a write after a network failure', async () => {
    const base = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    await expect(
      createResilientFetch(base, { retryDelayMs: 0 })(REST_URL, { method: 'PATCH', body: '{}' }),
    ).rejects.toThrow('fetch failed')
    expect(base).toHaveBeenCalledTimes(1)
  })

  it('gives up on a stalled write at the deadline instead of waiting on the gateway', async () => {
    const base = stalled()
    await expect(
      createResilientFetch(base, { timeoutMs: 20, retryDelayMs: 0 })(REST_URL, { method: 'POST' }),
    ).rejects.toHaveProperty('name', 'TimeoutError')
    expect(base).toHaveBeenCalledTimes(1)
  })

  it('retries a stalled read once, then gives up', async () => {
    const base = stalled()
    await expect(createResilientFetch(base, { timeoutMs: 20, retryDelayMs: 0 })(REST_URL)).rejects.toHaveProperty(
      'name',
      'TimeoutError',
    )
    expect(base).toHaveBeenCalledTimes(2)
  })

  it('does not retry a read the caller aborted', async () => {
    const base = stalled()
    const controller = new AbortController()
    const pending = createResilientFetch(base, { timeoutMs: 1000, retryDelayMs: 0 })(REST_URL, {
      signal: controller.signal,
    })
    controller.abort(new DOMException('left the page', 'AbortError'))
    await expect(pending).rejects.toHaveProperty('name', 'AbortError')
    expect(base).toHaveBeenCalledTimes(1)
  })
})
