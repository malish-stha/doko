import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { anthropicProvider } from './anthropic'
import { googleProvider } from './google'
import { LLMError } from './types'

// Real provider modules (no mocks): a missing key must be a hard error.
describe('providers without credentials', () => {
  const saved = { a: process.env.ANTHROPIC_API_KEY, g: process.env.GOOGLE_GENAI_API_KEY, m: process.env.LLM_MOCK }
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GOOGLE_GENAI_API_KEY
    delete process.env.LLM_MOCK
  })
  afterEach(() => {
    if (saved.a !== undefined) process.env.ANTHROPIC_API_KEY = saved.a
    if (saved.g !== undefined) process.env.GOOGLE_GENAI_API_KEY = saved.g
    if (saved.m !== undefined) process.env.LLM_MOCK = saved.m
  })

  const args = { systemPrompt: 's', userPrompt: 'u', model: 'brief' } as const

  test('anthropic throws MISSING_API_KEY instead of returning canned prose', async () => {
    await expect(anthropicProvider.summarize(args)).rejects.toMatchObject({ code: 'MISSING_API_KEY' })
    await expect(anthropicProvider.summarize(args)).rejects.toBeInstanceOf(LLMError)
  })

  test('google throws MISSING_API_KEY instead of returning canned prose', async () => {
    await expect(googleProvider.summarize(args)).rejects.toMatchObject({ code: 'MISSING_API_KEY' })
  })
})
