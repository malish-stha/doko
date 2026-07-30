import { anthropicProvider } from './anthropic'
import { googleProvider } from './google'
import { LLMProvider, ModelTier, SummarizeArgs } from './types'

function providerFor(tier: ModelTier, providerOverride?: string): LLMProvider {
  const envVar = tier === 'brief' ? 'LLM_BRIEF_PROVIDER' : 'LLM_QUICK_PROVIDER'
  const choice = (providerOverride ?? process.env[envVar] ?? 'anthropic').toLowerCase()
  if (choice === 'google') return googleProvider
  return anthropicProvider
}

export async function summarize(args: SummarizeArgs): Promise<string> {
  return providerFor(args.model, args.provider).summarize(args)
}

export type { SummarizeArgs, ModelTier }
