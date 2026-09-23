export type ModelTier = 'brief' | 'quick'

export const PROVIDER_NAMES = ['anthropic', 'google'] as const
export type ProviderName = (typeof PROVIDER_NAMES)[number]

export function isProviderName(value: string): value is ProviderName {
  return (PROVIDER_NAMES as readonly string[]).includes(value)
}

export type SummarizeArgs = {
  systemPrompt: string
  userPrompt: string
  model: ModelTier
  /** Explicit provider; otherwise LLM_<TIER>_PROVIDER decides. */
  provider?: ProviderName
}

export type SummarizeResult = {
  text: string
  provider: ProviderName
  model: string
}

export type LLMProvider = {
  name: ProviderName
  summarize: (args: SummarizeArgs) => Promise<SummarizeResult>
}

/** Errors that should surface to callers with a stable code. */
export class LLMError extends Error {
  constructor(
    public readonly code: 'MISSING_API_KEY' | 'EMPTY_RESPONSE' | 'TRUNCATED' | 'REFUSED' | 'UPSTREAM' | 'TIMEOUT',
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'LLMError'
  }
}

export const LLM_TIMEOUT_MS = 45_000
