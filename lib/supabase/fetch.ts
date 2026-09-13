/**
 * The fetch the server-side Supabase clients use: a deadline on every request,
 * and one retry for reads.
 *
 * On 2026-09-13 two PostgREST requests stalled inside Supabase's gateway for a
 * full minute right after a member signed in, then came back 504 Gateway
 * Timeout. Postgres was not the cause (the slowest app query that day finished
 * in under half a second); the requests simply never returned. The page waited
 * out the whole minute and then showed the error screen.
 *
 * Two changes bound that failure:
 *   - a deadline, so a stalled request gives up in seconds rather than a minute;
 *   - one retry for a read (GET or HEAD) that timed out, failed at the network,
 *     or came back 502, 503 or 504. Writes and RPCs are POST, PATCH or DELETE
 *     and are never retried, because repeating one could apply it twice.
 */

export const SUPABASE_TIMEOUT_MS = 15_000

const RETRY_DELAY_MS = 250
const RETRYABLE_STATUS = new Set([502, 503, 504])

type Options = { timeoutMs?: number; retryDelayMs?: number }

export function createResilientFetch(
  baseFetch: typeof fetch = fetch,
  { timeoutMs = SUPABASE_TIMEOUT_MS, retryDelayMs = RETRY_DELAY_MS }: Options = {},
): typeof fetch {
  async function attempt(input: RequestInfo | URL, init: RequestInit | undefined): Promise<Response> {
    // AbortSignal.any would say this in one line, but middleware runs on the
    // edge runtime, so the caller's signal is forwarded by hand.
    const controller = new AbortController()
    const upstream = init?.signal
    const forwardAbort = () => controller.abort(upstream?.reason)
    if (upstream?.aborted) controller.abort(upstream.reason)
    else upstream?.addEventListener('abort', forwardAbort, { once: true })

    const timer = setTimeout(
      () => controller.abort(new DOMException('Supabase request timed out', 'TimeoutError')),
      timeoutMs,
    )
    try {
      return await baseFetch(input, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
      upstream?.removeEventListener('abort', forwardAbort)
    }
  }

  return async function resilientFetch(input: RequestInfo | URL, init?: RequestInit) {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const retryable = method === 'GET' || method === 'HEAD'

    try {
      const response = await attempt(input, init)
      if (!retryable || !RETRYABLE_STATUS.has(response.status)) return response
    } catch (error) {
      // A caller that aborted has moved on; retrying would fight it.
      if (!retryable || init?.signal?.aborted) throw error
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    return attempt(input, init)
  }
}
