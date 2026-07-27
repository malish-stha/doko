import Anthropic from '@anthropic-ai/sdk'
import { LLMProvider, SummarizeArgs } from './types'

const MODEL_MAP = {
  brief: 'claude-3-7-sonnet-20250219',
  quick: 'claude-3-5-haiku-20241022',
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e: any) {
      lastErr = e
      const status = e?.status ?? 0
      if (status < 500 && status !== 429) throw e
      const waitMs = 500 * Math.pow(2, i)
      await new Promise(r => setTimeout(r, waitMs))
    }
  }
  throw lastErr
}

export const anthropicProvider: LLMProvider = {
  async summarize(args: SummarizeArgs) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.warn('[llm] ANTHROPIC_API_KEY missing, using fallback mock response')
      return `Here is your Morning Brief (Mock Anthropic output):\n\nYesterday the team shipped authentication and Kanban board features. Today, prioritize reviewing open PRs and completing the chat bridge.`
    }

    try {
      const client = new Anthropic({ apiKey })
      const model = MODEL_MAP[args.model]
      const res = await withRetry(() =>
        client.messages.create({
          model,
          max_tokens: 1024,
          system: [
            {
              type: 'text',
              text: args.systemPrompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [{ role: 'user', content: args.userPrompt }],
        }),
      )
      const usage = res.usage
      console.log(
        `[llm] tier=${args.model} provider=anthropic in=${usage.input_tokens} out=${usage.output_tokens} cache_read=${(usage as any).cache_read_input_tokens ?? 0}`,
      )
      const first = res.content[0]
      if (first.type !== 'text') throw new Error('unexpected content type')
      return first.text
    } catch (err: any) {
      console.error('[llm] Anthropic API call error:', err?.message ?? err)
      return `[Anthropic Fallback] Yesterday the team shipped auth, Kanban board, and chat bridge. Today, prioritize testing and reviewing open PRs.`
    }
  },
}
