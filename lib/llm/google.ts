import { GoogleGenAI } from '@google/genai'
import { LLMError, LLMProvider, LLM_TIMEOUT_MS, SummarizeArgs, SummarizeResult } from './types'
import { errorMessage, statusOf, withRetry } from './retry'

export const GOOGLE_MODELS = {
  brief: 'gemini-2.0-flash',
  quick: 'gemini-1.5-flash',
} as const
const FALLBACK_MODEL = 'gemini-1.5-flash'

/** gRPC RESOURCE_EXHAUSTED (code 8) and HTTP 429/5xx are worth retrying. */
function isRetryable(err: unknown) {
  const status = statusOf(err)
  if (status === 8 || status === 429 || (status !== undefined && status >= 500)) return true
  return /RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED/i.test(errorMessage(err))
}

async function generate(client: GoogleGenAI, model: string, args: SummarizeArgs) {
  const res = await withRetry(
    () =>
      client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: args.userPrompt }] }],
        config: {
          systemInstruction: args.systemPrompt,
          abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        },
      }),
    { isRetryable },
  )
  const usage = res.usageMetadata
  console.log(
    `[llm] tier=${args.model} provider=google model=${model} in=${usage?.promptTokenCount ?? 0} out=${usage?.candidatesTokenCount ?? 0}`,
  )
  const text = res.text?.trim()
  if (!text) {
    console.warn(`[llm] provider=google model=${model} returned an empty response`)
    throw new LLMError('EMPTY_RESPONSE', 'The model returned no text.')
  }
  return text
}

export const googleProvider: LLMProvider = {
  name: 'google',
  async summarize(args: SummarizeArgs): Promise<SummarizeResult> {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY
    if (!apiKey) {
      throw new LLMError('MISSING_API_KEY', 'GOOGLE_GENAI_API_KEY is not set on the Convex deployment.')
    }

    const client = new GoogleGenAI({ apiKey })
    const primary = GOOGLE_MODELS[args.model]

    try {
      return { text: await generate(client, primary, args), provider: 'google', model: primary }
    } catch (primaryErr) {
      if (primaryErr instanceof LLMError && primaryErr.code === 'TIMEOUT') throw primaryErr
      // Only fall back when the fallback is a different model.
      if (primary === FALLBACK_MODEL) {
        throw primaryErr instanceof LLMError
          ? primaryErr
          : new LLMError('UPSTREAM', `Gemini request failed: ${errorMessage(primaryErr)}`, primaryErr)
      }
      console.warn(`[llm] ${primary} failed (${errorMessage(primaryErr)}); trying ${FALLBACK_MODEL}`)
    }

    try {
      return { text: await generate(client, FALLBACK_MODEL, args), provider: 'google', model: FALLBACK_MODEL }
    } catch (err) {
      if (err instanceof LLMError) throw err
      throw new LLMError('UPSTREAM', `Gemini request failed: ${errorMessage(err)}`, err)
    }
  },
}
