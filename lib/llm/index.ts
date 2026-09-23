import { anthropicProvider } from './anthropic'
import { googleProvider } from './google'
import {
  LLMError,
  LLMProvider,
  ModelTier,
  ProviderName,
  SummarizeArgs,
  SummarizeResult,
  isProviderName,
} from './types'

/**
 * Deterministic canned output for local development and tests. Only active
 * when LLM_MOCK=1; a missing API key is otherwise a hard error, never
 * fabricated prose presented as a real brief.
 */
const mockProvider: LLMProvider = {
  name: 'anthropic',
  async summarize(args) {
    return {
      text: `[mock brief] ${args.userPrompt.slice(0, 80).replace(/\s+/g, ' ')}…`,
      provider: 'anthropic',
      model: 'mock',
    }
  },
}

export function isMockMode() {
  return process.env.LLM_MOCK === '1'
}

/** Resolves the provider for a tier; unknown names are an error, not a silent default. */
export function getProviderUsed(tier: ModelTier, providerOverride?: string): ProviderName {
  const envVar = tier === 'brief' ? 'LLM_BRIEF_PROVIDER' : 'LLM_QUICK_PROVIDER'
  const raw = providerOverride ?? process.env[envVar] ?? 'anthropic'
  const choice = raw.trim().toLowerCase()
  if (!isProviderName(choice)) {
    throw new LLMError('UPSTREAM', `Unknown LLM provider "${raw}" (expected anthropic or google).`)
  }
  return choice
}

function providerFor(tier: ModelTier, providerOverride?: string): LLMProvider {
  if (isMockMode()) return mockProvider
  return getProviderUsed(tier, providerOverride) === 'google' ? googleProvider : anthropicProvider
}

export async function summarize(args: SummarizeArgs): Promise<SummarizeResult> {
  return providerFor(args.model, args.provider).summarize(args)
}

export { LLMError }
export type { SummarizeArgs, SummarizeResult, ModelTier, ProviderName }
