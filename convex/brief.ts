import { v } from 'convex/values'
import { internalAction, internalMutation, internalQuery, query } from './_generated/server'
import { internal } from './_generated/api'
import { Doc } from './_generated/dataModel'
import { requireUser } from './teamHelper'
import { canAccessChannel } from './channels'
import { DAY_MS, localDateString, localHour, startOfLocalDay } from '../lib/time'

const BRIEF_HOUR_LOCAL = 8

export const todayForMe = query({
  args: {},
  handler: async ctx => {
    const { userId, user } = await requireUser(ctx)
    const tz = user?.timezone ?? 'UTC'
    const localDate = localDateString(tz)

    return await ctx.db
      .query('briefs')
      .withIndex('by_user_date', q => q.eq('userId', userId).eq('forDate', localDate))
      .first()
  },
})

export const readUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .first()
  },
})

export const ensureUser = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    email: v.string(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .first()
    if (existing) return existing._id
    return await ctx.db.insert('users', {
      userId: args.userId,
      email: args.email,
      name: args.name,
      timezone: args.timezone,
      createdAt: Date.now(),
    })
  },
})

export const briefExists = internalQuery({
  args: { userId: v.string(), forDate: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('briefs')
      .withIndex('by_user_date', q => q.eq('userId', args.userId).eq('forDate', args.forDate))
      .first()
    return row !== null
  },
})

/**
 * Everything the brief may talk about: the user's active team's activity from
 * the previous local day up to now, restricted to channels the user can see,
 * plus their open tickets in that team.
 */
export const readContext = internalQuery({
  args: { userId: v.string(), forDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .first()

    // No team means no shared activity: an empty brief context, never a cross-team bucket.
    if (!user?.teamId) {
      return { events: [] as Doc<'activityEvents'>[], myTickets: [] as Doc<'tickets'>[], user }
    }
    const teamId = user.teamId as string
    const tz = user.timezone ?? 'UTC'
    const forDate = args.forDate ?? localDateString(tz)
    const windowStart = startOfLocalDay(forDate, tz) - DAY_MS

    const rawEvents = await ctx.db
      .query('activityEvents')
      .withIndex('by_team_ts', q => q.eq('teamId', teamId).gte('ts', windowStart))
      .take(500)

    const channelCache = new Map<string, Doc<'channels'> | null>()
    const loadChannel = async (id: string) => {
      if (!channelCache.has(id)) {
        const normalized = ctx.db.normalizeId('channels', id)
        channelCache.set(id, normalized ? await ctx.db.get(normalized) : null)
      }
      return channelCache.get(id) ?? null
    }

    const events: Doc<'activityEvents'>[] = []
    for (const e of rawEvents) {
      let channel: Doc<'channels'> | null = null
      if (e.refType === 'channel') {
        channel = await loadChannel(e.refId)
      } else if (e.refType === 'message' || e.refType === 'reaction') {
        const channelId = typeof e.payload?.channelId === 'string' ? e.payload.channelId : null
        if (channelId) channel = await loadChannel(channelId)
        else {
          const msgId = ctx.db.normalizeId('messages', e.refId)
          const msg = msgId ? await ctx.db.get(msgId) : null
          if (msg) channel = await loadChannel(msg.channelId)
        }
      }
      if (e.refType === 'channel' || e.refType === 'message' || e.refType === 'reaction') {
        // Private channels and DMs the user is not in stay out of their brief.
        if (!channel || !canAccessChannel(channel, args.userId)) continue
        events.push({
          ...e,
          payload: {
            ...(typeof e.payload === 'object' && e.payload ? e.payload : {}),
            channelKind: channel.kind ?? (channel.isPrivate ? 'private' : 'public'),
            channelName: channel.name,
            isDirectRecipient: channel.kind === 'dm',
          },
        })
        continue
      }
      events.push(e)
    }

    const myTickets = (
      await ctx.db
        .query('tickets')
        .withIndex('by_assignee', q => q.eq('assigneeId', args.userId))
        .filter(f => f.neq(f.field('status'), 'done'))
        .take(100)
    ).filter(t => t.teamId === teamId)

    return { events, myTickets, user }
  },
})

export const writeBrief = internalMutation({
  args: {
    userId: v.string(),
    forDate: v.string(),
    body: v.string(),
    sourceEventIds: v.array(v.id('activityEvents')),
    providerUsed: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('briefs')
      .withIndex('by_user_date', q => q.eq('userId', args.userId).eq('forDate', args.forDate))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        body: args.body,
        generatedAt: Date.now(),
        sourceEventIds: args.sourceEventIds,
        providerUsed: args.providerUsed,
      })
      return existing._id
    }

    return await ctx.db.insert('briefs', {
      ...args,
      generatedAt: Date.now(),
    })
  },
})

export const listAllUsers = internalQuery({
  args: {},
  handler: async ctx => await ctx.db.query('users').collect(),
})

/**
 * Runs at the top of every UTC hour (see crons.ts). For each user whose local
 * time is 08:xx and who has no brief for today yet, generate one. One user's
 * failure never stops the others.
 */
export const hourlyTick = internalAction({
  args: {},
  handler: async ctx => {
    const users = await ctx.runQuery(internal.brief.listAllUsers)
    let generated = 0
    let failed = 0
    for (const user of users) {
      try {
        const tz = user.timezone || 'UTC'
        if (localHour(tz) !== BRIEF_HOUR_LOCAL) continue
        const forDate = localDateString(tz)
        if (await ctx.runQuery(internal.brief.briefExists, { userId: user.userId, forDate })) continue
        await ctx.runAction(internal.briefActions.generate, { userId: user.userId, forDate })
        generated++
      } catch (err) {
        failed++
        console.error(`[brief] hourlyTick failed for ${user.userId}:`, err instanceof Error ? err.message : err)
      }
    }
    console.log(`[brief] hourlyTick generated=${generated} failed=${failed} users=${users.length}`)
  },
})
