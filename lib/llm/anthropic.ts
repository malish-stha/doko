import Anthropic from '@anthropic-ai/sdk'
import { LLMError, LLMProvider, LLM_TIMEOUT_MS, SummarizeArgs, SummarizeResult } from './types'
import { errorMessage, statusOf, withRetry } from './retry'

// Current model ids (no date suffixes). Briefs get Opus; the quick tier uses Haiku.
export const ANTHROPIC_MODELS = {
  brief: 'claude-opus-5',
  quick: 'claude-haiku-4-5',
} as const

function isRetryable(err: unknown) {
  if (err instanceof Anthropic.RateLimitError) return true
  if (err instanceof Anthropic.APIConnectionError) return true
  if (err instanceof Anthropic.InternalServerError) return true
  const status = statusOf(err)
  return status === 429 || status === 408 || status === 409 || (status !== undefined && status >= 500)
}

export const anthropicProvider: LLMProvider = {
  name: 'anthropic',
  async summarize(args: SummarizeArgs): Promise<SummarizeResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new LLMError('MISSING_API_KEY', 'ANTHROPIC_API_KEY is not set on the Convex deployment.')
    }

    const client = new Anthropic({ apiKey, maxRetries: 0 })
    const model = ANTHROPIC_MODELS[args.model]

    let res: Anthropic.Message
    try {
      res = await withRetry(
        () =>
          client.messages.create(
            {
              model,
              max_tokens: 2048,
              system: [{ type: 'text', text: args.systemPrompt, cache_control: { type: 'ephemeral' } }],
              messages: [{ role: 'user', content: args.userPrompt }],
            },
            { signal: AbortSignal.timeout(LLM_TIMEOUT_MS) },
          ),
        { isRetryable },
      )
    } catch (err) {
      if (err instanceof LLMError) throw err
      throw new LLMError('UPSTREAM', `Anthropic request failed: ${errorMessage(err)}`, err)
    }

    const usage = res.usage
    console.log(
      `[llm] tier=${args.model} provider=anthropic model=${model} stop=${res.stop_reason} in=${usage.input_tokens} out=${usage.output_tokens} cache_read=${usage.cache_read_input_tokens ?? 0}`,
    )

    if (res.stop_reason === 'refusal') {
      throw new LLMError('REFUSED', 'The model declined to write this brief.')
    }
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim()
    if (!text) throw new LLMError('EMPTY_RESPONSE', 'The model returned no text.')
    if (res.stop_reason === 'max_tokens') {
      throw new LLMError('TRUNCATED', 'The brief was cut off before it finished.')
    }
    return { text, provider: 'anthropic', model }
  },
}
