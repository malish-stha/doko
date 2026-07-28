"use node";

import { v } from 'convex/values'
import { action, internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { summarize } from '../lib/llm'
import { SYSTEM_PROMPT_V2 } from '../lib/llm/prompts/brief-system'
import { buildUserPrompt } from '../lib/llm/prompts/brief-user'

export const generateNow = action({
  args: {},
  handler: async ctx => {
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
    await ctx.runMutation(internal.rateLimit.checkAndRecord, {
      userId,
      actionType: 'brief_generation',
    })

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
      userId,
      forDate,
      body,
      sourceEventIds: events.map(e => e._id),
      providerUsed: process.env.LLM_BRIEF_PROVIDER ?? 'google',
    })

    return body
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
  args: { userId: v.string(), forDate: v.string(), provider: v.string() },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.rateLimit.checkAndRecord, {
      userId: args.userId,
      actionType: 'brief_generation',
    })

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

    process.env.LLM_BRIEF_PROVIDER = args.provider
    return await summarize({
      systemPrompt,
      userPrompt,
      model: 'brief',
      cacheKey: 'brief-system-v2',
    })
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
