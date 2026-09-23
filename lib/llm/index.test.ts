import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./anthropic', () => ({
  anthropicProvider: {
    name: 'anthropic',
    summarize: vi.fn(async () => ({ text: 'anthropic-response', provider: 'anthropic', model: 'claude-opus-5' })),
  },
}))
vi.mock('./google', () => ({
  googleProvider: {
    name: 'google',
    summarize: vi.fn(async () => ({ text: 'google-response', provider: 'google', model: 'gemini-2.0-flash' })),
  },
}))

import { summarize, getProviderUsed } from './index'
import { anthropicProvider } from './anthropic'
import { googleProvider } from './google'
import { withRetry } from './retry'
import { LLMError } from './types'

const ARGS = { systemPrompt: 's', userPrompt: 'u', model: 'brief' } as const

describe('llm adapter routing', () => {
  const savedMock = process.env.LLM_MOCK
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.LLM_BRIEF_PROVIDER
    delete process.env.LLM_QUICK_PROVIDER
    delete process.env.LLM_MOCK
  })
  afterEach(() => {
    if (savedMock === undefined) delete process.env.LLM_MOCK
    else process.env.LLM_MOCK = savedMock
  })

  test('defaults to anthropic and returns provider + model', async () => {
    const out = await summarize(ARGS)
    expect(anthropicProvider.summarize).toHaveBeenCalledOnce()
    expect(out).toEqual({ text: 'anthropic-response', provider: 'anthropic', model: 'claude-opus-5' })
  })

  test('routes to google when LLM_BRIEF_PROVIDER=google', async () => {
    process.env.LLM_BRIEF_PROVIDER = 'google'
    await summarize(ARGS)
    expect(googleProvider.summarize).toHaveBeenCalledOnce()
    expect(anthropicProvider.summarize).not.toHaveBeenCalled()
  })

  test('brief and quick can use different providers', async () => {
    process.env.LLM_BRIEF_PROVIDER = 'anthropic'
    process.env.LLM_QUICK_PROVIDER = 'google'
    await summarize(ARGS)
    await summarize({ ...ARGS, model: 'quick' })
    expect(anthropicProvider.summarize).toHaveBeenCalledOnce()
    expect(googleProvider.summarize).toHaveBeenCalledOnce()
  })

  test('an unknown provider is an error, not a silent Anthropic default', () => {
    process.env.LLM_BRIEF_PROVIDER = 'openai'
    expect(() => getProviderUsed('brief')).toThrow(/Unknown LLM provider/)
  })

  test('LLM_MOCK=1 short-circuits both providers with canned text', async () => {
    process.env.LLM_MOCK = '1'
    const out = await summarize(ARGS)
    expect(out.model).toBe('mock')
    expect(anthropicProvider.summarize).not.toHaveBeenCalled()
    expect(googleProvider.summarize).not.toHaveBeenCalled()
  })
})

describe('withRetry', () => {
  test('retries retryable failures and stops after the last attempt without sleeping', async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      const promise = withRetry(
        async () => {
          calls++
          throw Object.assign(new Error('rate limited'), { status: 429 })
        },
        { attempts: 3, baseDelayMs: 100, isRetryable: e => (e as { status?: number }).status === 429 },
      )
      const settled = promise.catch(e => e)
      // Two backoffs (100ms, 200ms) between three attempts; nothing after the third.
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(200)
      const err = await settled
      expect(calls).toBe(3)
      expect((err as Error).message).toBe('rate limited')
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  test('permanent failures are not retried', async () => {
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls++
          throw Object.assign(new Error('bad request'), { status: 400 })
        },
        { isRetryable: () => false },
      ),
    ).rejects.toThrow('bad request')
    expect(calls).toBe(1)
  })

  test('aborts become TIMEOUT errors', async () => {
    await expect(
      withRetry(
        async () => {
          throw Object.assign(new Error('aborted'), { name: 'TimeoutError' })
        },
        { isRetryable: () => true },
      ),
    ).rejects.toBeInstanceOf(LLMError)
  })
})
