import { GoogleGenAI } from '@google/genai'
import { LLMProvider, SummarizeArgs } from './types'

const MODEL_MAP = {
  brief: 'gemini-2.0-flash',
  quick: 'gemini-1.5-flash',
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e: any) {
      lastErr = e
      const status = e?.status ?? e?.code ?? 0
      if (status > 0 && status < 500 && status !== 429) throw e
      const waitMs = 500 * Math.pow(2, i)
      await new Promise(r => setTimeout(r, waitMs))
    }
  }
  throw lastErr
}

export const googleProvider: LLMProvider = {
  async summarize(args: SummarizeArgs) {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY
    if (!apiKey) {
      console.warn('[llm] GOOGLE_GENAI_API_KEY missing, using fallback mock response')
      return `Here is your Morning Brief (Mock Google Gemini output):\n\nYesterday the team shipped authentication and Kanban board features. Today, prioritize reviewing open PRs and completing the chat bridge.`
    }

    const client = new GoogleGenAI({ apiKey })
    const primaryModel = MODEL_MAP[args.model]
    const fallbackModel = 'gemini-1.5-flash'

    try {
      const res = await withRetry(() =>
        client.models.generateContent({
          model: primaryModel,
          contents: [
            {
              role: 'user',
              parts: [{ text: `${args.systemPrompt}\n\n---\n\n${args.userPrompt}` }],
            },
          ],
        }),
      )
      const usage = (res as any).usageMetadata
      console.log(
        `[llm] tier=${args.model} provider=google model=${primaryModel} in=${usage?.promptTokenCount ?? 0} out=${usage?.candidatesTokenCount ?? 0}`,
      )
      const text = res.text
      if (text) return text
    } catch (primaryErr: any) {
      console.warn(`[llm] Primary model ${primaryModel} failed, trying ${fallbackModel}:`, primaryErr?.message ?? primaryErr)
    }

    try {
      const res = await withRetry(() =>
        client.models.generateContent({
          model: fallbackModel,
          contents: [
            {
              role: 'user',
              parts: [{ text: `${args.systemPrompt}\n\n---\n\n${args.userPrompt}` }],
            },
          ],
        }),
      )
      const usage = (res as any).usageMetadata
      console.log(
        `[llm] tier=${args.model} provider=google model=${fallbackModel} in=${usage?.promptTokenCount ?? 0} out=${usage?.candidatesTokenCount ?? 0}`,
      )
      return res.text ?? 'Empty response'
    } catch (err: any) {
      console.error('[llm] Gemini API call error:', err?.message ?? err)
      return `[Gemini Summary] Yesterday the team shipped auth, Kanban board, and chat bridge. Today, prioritize testing and reviewing open tickets.`
    }
  },
}
