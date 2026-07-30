"use node";

import { v, ConvexError } from 'convex/values'
import { action, internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { summarize } from '../lib/llm'
import { SYSTEM_PROMPT_V2 } from '../lib/llm/prompts/brief-system'
import { buildUserPrompt } from '../lib/llm/prompts/brief-user'

export const generateNow = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; body?: string; error?: string }> => {
    try {
      const identity = await ctx.auth.getUserIdentity()
      const userId = identity?.subject ?? identity?.name ?? 'dev-user'

      let user = await ctx.runQuery(internal.brief.readUser, { userId })
      if (!user) {
        const tz = 'UTC'
        await ctx.runMutation(internal.brief.ensureUser, {
          userId,
          name: identity?.name ?? 'Dev User',
          email: identity?.email ?? 'dev@doko.internal',
          timezone: tz,
        })
        user = await ctx.runQuery(internal.brief.readUser, { userId })
      }

      const tz = user?.timezone ?? 'UTC'
      const forDate = new Date()
        .toLocaleString('en-CA', { timeZone: tz })
        .split(',')[0]

      // Enforce extreme AI rate limiting before invoking LLM
      try {
        await ctx.runMutation(internal.rateLimit.checkAndRecord, {
          userId,
          actionType: 'brief_generation',
        })
      } catch (rateLimitErr: any) {
        const rawMsg = rateLimitErr?.data ?? rateLimitErr?.message ?? String(rateLimitErr)
        const cleanMsg = typeof rawMsg === 'string'
          ? rawMsg.replace(/^.*ConvexError:\s*/, '').replace(/\[CONVEX M\([^)]+\)\]\s*/, '')
          : 'AI Rate Limit exceeded. Please wait a few minutes before generating again.'
        return { success: false, error: cleanMsg }
      }

      const { events, myTickets, user: loadedUser } = await ctx.runQuery(
        internal.brief.readContext,
        { userId },
      )

      const systemPrompt = SYSTEM_PROMPT_V2
      const userPrompt = buildUserPrompt({
        user: loadedUser ?? {
          userId,
          email: identity?.email ?? 'dev@doko.internal',
          name: identity?.name ?? 'Dev User',
          timezone: tz,
          createdAt: Date.now(),
          _id: '' as any,
          _creationTime: Date.now(),
        },
        forDate,
        events: events ?? [],
        myTickets: myTickets ?? [],
      })

      const body = await summarize({
        systemPrompt,
        userPrompt,
        model: 'brief',
        cacheKey: 'brief-system-v2',
      })

      await ctx.runMutation(internal.brief.writeBrief, {
        userId,
        forDate,
        body,
        sourceEventIds: (events ?? []).map(e => e._id),
        providerUsed: process.env.LLM_BRIEF_PROVIDER ?? 'google',
      })

      return { success: true, body }
    } catch (err: any) {
      const rawMsg = err?.data ?? err?.message ?? String(err)
      const cleanMsg = typeof rawMsg === 'string'
        ? rawMsg.replace(/^.*ConvexError:\s*/, '').replace(/\[CONVEX M\([^)]+\)\]\s*/, '')
        : 'Failed to generate brief.'
      return { success: false, error: cleanMsg }
    }
  },
})

export const generate = internalAction({
  args: { userId: v.string(), forDate: v.string() },
  handler: async (ctx, args) => {
    const { events, myTickets, user } = await ctx.runQuery(
      internal.brief.readContext,
      { userId: args.userId },
    )
    if (!user) return

    const systemPrompt = SYSTEM_PROMPT_V2
    const userPrompt = buildUserPrompt({
      user,
      forDate: args.forDate,
      events,
      myTickets,
    })

    const body = await summarize({
      systemPrompt,
      userPrompt,
      model: 'brief',
      cacheKey: 'brief-system-v2',
    })

    await ctx.runMutation(internal.brief.writeBrief, {
      userId: args.userId,
      forDate: args.forDate,
      body,
      sourceEventIds: events.map(e => e._id),
      providerUsed: process.env.LLM_BRIEF_PROVIDER ?? 'google',
    })
  },
})

export const generateForProvider = action({
  args: {
    userId: v.string(),
    forDate: v.string(),
    provider: v.string(),
    skipRateLimit: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    try {
      if (!args.skipRateLimit) {
        await ctx.runMutation(internal.rateLimit.checkAndRecord, {
          userId: args.userId,
          actionType: 'brief_generation',
        })
      }

      const { events, myTickets, user } = await ctx.runQuery(
        internal.brief.readContext,
        { userId: args.userId },
      )

      const systemPrompt = SYSTEM_PROMPT_V2
      const userPrompt = buildUserPrompt({
        user: user ?? {
          userId: args.userId,
          email: 'dev@doko.internal',
          name: 'Dev User',
          timezone: 'UTC',
          createdAt: Date.now(),
          _id: '' as any,
          _creationTime: Date.now(),
        },
        forDate: args.forDate,
        events: events ?? [],
        myTickets: myTickets ?? [],
      })

      return await summarize({
        systemPrompt,
        userPrompt,
        model: 'brief',
        cacheKey: 'brief-system-v2',
        provider: args.provider,
      })
    } catch (err: any) {
      if (err instanceof ConvexError) throw err
      const msg = err?.data ?? err?.message ?? String(err)
      throw new ConvexError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
  },
})

export const hourlyTick = internalAction({
  args: {},
  handler: async ctx => {
    const users = await ctx.runQuery(internal.brief.listAllUsers)
    for (const user of users) {
      const localHour = new Date().toLocaleString('en-US', {
        timeZone: user.timezone,
        hour: '2-digit',
        hour12: false,
      })
      if (parseInt(localHour) !== 8) continue
      const localDate = new Date()
        .toLocaleString('en-CA', { timeZone: user.timezone })
        .split(',')[0]
      await ctx.runAction(internal.briefActions.generate, {
        userId: user.userId,
        forDate: localDate,
      })
    }
  },
})
