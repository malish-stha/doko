"use node";

import { v, ConvexError } from 'convex/values'
import { action, internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { LLMError, summarize } from '../lib/llm'
import { SYSTEM_PROMPT_V2 } from '../lib/llm/prompts/brief-system'
import { buildUserPrompt } from '../lib/llm/prompts/brief-user'
import { localDateString } from '../lib/time'

const ACTION_TYPE = 'brief_generation'

type GenerateResult = { success: true; body: string } | { success: false; error: string; code?: string }

/** Turns any failure into a short, user-facing message and logs the detail. */
function describeFailure(err: unknown, context: string): { error: string; code: string } {
  if (err instanceof ConvexError) {
    const data = err.data as unknown
    const message =
      typeof data === 'string' ? data : typeof data === 'object' && data && 'message' in data ? String((data as { message: unknown }).message) : 'Request rejected.'
    console.warn(`[brief] ${context}: ${message}`)
    return { error: message, code: 'REJECTED' }
  }
  if (err instanceof LLMError) {
    console.error(`[brief] ${context}: ${err.code} ${err.message}`, err.cause ?? '')
    const friendly: Record<LLMError['code'], string> = {
      MISSING_API_KEY: 'The AI provider is not configured on this deployment yet.',
      EMPTY_RESPONSE: 'The model returned an empty brief. Please try again.',
      TRUNCATED: 'The brief was cut off. Please try again.',
      REFUSED: 'The model declined to write this brief.',
      UPSTREAM: 'The AI provider is unavailable right now. Please try again shortly.',
      TIMEOUT: 'Generating the brief took too long. Please try again.',
    }
    return { error: friendly[err.code], code: err.code }
  }
  console.error(`[brief] ${context}:`, err)
  return { error: 'Failed to generate the brief.', code: 'UNKNOWN' }
}

/** Generates (or regenerates) today's brief for the signed-in user. */
export const generateNow = action({
  args: {},
  handler: async (ctx): Promise<GenerateResult> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { success: false, error: 'You must be signed in to generate a brief.', code: 'UNAUTHENTICATED' }
    }
    const userId = identity.subject
    const identityEmail = identity.email?.trim().toLowerCase() ?? userId

    try {
      let user = await ctx.runQuery(internal.brief.readUser, { userId })
      if (!user) {
        await ctx.runMutation(internal.brief.ensureUser, {
          userId,
          name: identity.name ?? identityEmail,
          email: identityEmail,
          timezone: 'UTC',
        })
        user = await ctx.runQuery(internal.brief.readUser, { userId })
      }
      const tz = user?.timezone ?? 'UTC'
      const forDate = localDateString(tz)

      // Check limits first, but only consume quota once a brief was actually written.
      await ctx.runMutation(internal.rateLimit.check, { userId, actionType: ACTION_TYPE })

      const { events, myTickets, user: loadedUser } = await ctx.runQuery(internal.brief.readContext, { userId, forDate })
      const userPrompt = buildUserPrompt({
        user: loadedUser ?? {
          userId,
          email: identityEmail,
          name: identity.name ?? identityEmail,
          timezone: tz,
          createdAt: Date.now(),
          _id: '' as never,
          _creationTime: Date.now(),
        },
        forDate,
        events,
        myTickets,
      })

      const result = await summarize({ systemPrompt: SYSTEM_PROMPT_V2, userPrompt, model: 'brief' })

      await ctx.runMutation(internal.brief.writeBrief, {
        userId,
        forDate,
        body: result.text,
        sourceEventIds: events.map(e => e._id),
        providerUsed: `${result.provider}/${result.model}`,
      })
      await ctx.runMutation(internal.rateLimit.record, { userId, actionType: ACTION_TYPE })

      return { success: true, body: result.text }
    } catch (err) {
      return { success: false, ...describeFailure(err, `generateNow user=${userId}`) }
    }
  },
})

/** Cron path: writes the brief for `userId` / `forDate`. Errors propagate to hourlyTick's per-user catch. */
export const generate = internalAction({
  args: { userId: v.string(), forDate: v.string() },
  handler: async (ctx, args) => {
    const { events, myTickets, user } = await ctx.runQuery(internal.brief.readContext, {
      userId: args.userId,
      forDate: args.forDate,
    })
    if (!user) return

    const userPrompt = buildUserPrompt({ user, forDate: args.forDate, events, myTickets })
    const result = await summarize({ systemPrompt: SYSTEM_PROMPT_V2, userPrompt, model: 'brief' })

    await ctx.runMutation(internal.brief.writeBrief, {
      userId: args.userId,
      forDate: args.forDate,
      body: result.text,
      sourceEventIds: events.map(e => e._id),
      providerUsed: `${result.provider}/${result.model}`,
    })
  },
})

/**
 * Developer tool: run the caller's brief through one provider without saving
 * it. Only the signed-in user's own context is used, the normal rate limit
 * applies, and the whole thing is disabled unless the deployment opts in with
 * LLM_ALLOW_PROVIDER_COMPARE=1.
 */
export const compareProviders = action({
  args: { provider: v.union(v.literal('anthropic'), v.literal('google')) },
  handler: async (ctx, args): Promise<GenerateResult & { provider?: string; model?: string }> => {
    if (process.env.LLM_ALLOW_PROVIDER_COMPARE !== '1') {
      return { success: false, error: 'Provider comparison is disabled on this deployment.', code: 'DISABLED' }
    }
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { success: false, error: 'You must be signed in.', code: 'UNAUTHENTICATED' }
    }
    const userId = identity.subject
    try {
      await ctx.runMutation(internal.rateLimit.check, { userId, actionType: 'provider_compare' })
      const user = await ctx.runQuery(internal.brief.readUser, { userId })
      if (!user) return { success: false, error: 'Create your profile first.', code: 'NO_USER' }
      const forDate = localDateString(user.timezone ?? 'UTC')
      const { events, myTickets } = await ctx.runQuery(internal.brief.readContext, { userId, forDate })
      const userPrompt = buildUserPrompt({ user, forDate, events, myTickets })
      const result = await summarize({ systemPrompt: SYSTEM_PROMPT_V2, userPrompt, model: 'brief', provider: args.provider })
      await ctx.runMutation(internal.rateLimit.record, { userId, actionType: 'provider_compare' })
      return { success: true, body: result.text, provider: result.provider, model: result.model }
    } catch (err) {
      return { success: false, ...describeFailure(err, `compareProviders user=${userId} provider=${args.provider}`) }
    }
  },
})
