import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('./anthropic', () => ({
  anthropicProvider: { summarize: vi.fn(async () => 'anthropic-response') },
}))
vi.mock('./google', () => ({
  googleProvider: { summarize: vi.fn(async () => 'google-response') },
}))

import { summarize } from './index'
import { anthropicProvider } from './anthropic'
import { googleProvider } from './google'

describe('llm adapter routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.LLM_BRIEF_PROVIDER
    delete process.env.LLM_QUICK_PROVIDER
  })

  test('defaults to anthropic', async () => {
    const out = await summarize({ systemPrompt: 's', userPrompt: 'u', model: 'brief' })
    expect(anthropicProvider.summarize).toHaveBeenCalledOnce()
    expect(out).toBe('anthropic-response')
  })

  test('routes to google when LLM_BRIEF_PROVIDER=google', async () => {
    process.env.LLM_BRIEF_PROVIDER = 'google'
    await summarize({ systemPrompt: 's', userPrompt: 'u', model: 'brief' })
    expect(googleProvider.summarize).toHaveBeenCalledOnce()
    expect(anthropicProvider.summarize).not.toHaveBeenCalled()
  })

  test('brief and quick can use different providers', async () => {
    process.env.LLM_BRIEF_PROVIDER = 'anthropic'
    process.env.LLM_QUICK_PROVIDER = 'google'
    await summarize({ systemPrompt: 's', userPrompt: 'u', model: 'brief' })
    await summarize({ systemPrompt: 's', userPrompt: 'u', model: 'quick' })
    expect(anthropicProvider.summarize).toHaveBeenCalledOnce()
    expect(googleProvider.summarize).toHaveBeenCalledOnce()
  })
})
