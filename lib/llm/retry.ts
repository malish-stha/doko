import { LLMError } from './types'

type RetryOptions = {
  attempts?: number
  baseDelayMs?: number
  /** Decide whether a failure is worth retrying. */
  isRetryable: (err: unknown) => boolean
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Retries `fn` with exponential backoff. Never sleeps after the final attempt,
 * never retries errors the caller deems permanent, and wraps a timeout abort
 * in an LLMError so callers can distinguish it.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const attempts = opts.attempts ?? 3
  const base = opts.baseDelayMs ?? 500
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (isAbort(err)) throw new LLMError('TIMEOUT', 'The model did not answer within the time limit.', err)
      if (!opts.isRetryable(err) || i === attempts - 1) break
      await sleep(base * 2 ** i)
    }
  }
  throw lastErr
}

export function isAbort(err: unknown) {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    ((err as { name?: string }).name === 'AbortError' || (err as { name?: string }).name === 'TimeoutError')
  )
}

export function statusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined
  const e = err as { status?: unknown; code?: unknown }
  if (typeof e.status === 'number') return e.status
  if (typeof e.code === 'number') return e.code
  return undefined
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}
