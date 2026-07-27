export type ModelTier = 'brief' | 'quick'

export type SummarizeArgs = {
  systemPrompt: string
  userPrompt: string
  model: ModelTier
  cacheKey?: string
}

export type LLMProvider = {
  summarize: (args: SummarizeArgs) => Promise<string>
}
