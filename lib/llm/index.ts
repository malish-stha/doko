import { anthropicProvider } from './anthropic'
import { googleProvider } from './google'
import { LLMProvider, ModelTier, SummarizeArgs } from './types'

function providerFor(tier: ModelTier): LLMProvider {
  const envVar = tier === 'brief' ? 'LLM_BRIEF_PROVIDER' : 'LLM_QUICK_PROVIDER'
  const choice = (process.env[envVar] ?? 'anthropic').toLowerCase()
  if (choice === 'google') return googleProvider
  return anthropicProvider
}

export async function summarize(args: SummarizeArgs): Promise<string> {
  return providerFor(args.model).summarize(args)
}

export type { SummarizeArgs, ModelTier }
