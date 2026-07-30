import { v } from 'convex/values'
import { internalAction, internalMutation, internalQuery, query } from './_generated/server'
import { internal } from './_generated/api'
import { Doc, Id } from './_generated/dataModel'
import { requireTeam } from './teamHelper'

export const todayForMe = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity()
    const cleanEmail = identity?.email?.trim().toLowerCase()
    const userId = identity?.subject ?? cleanEmail ?? 'dev-user'

    const user = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .first()

    const tz = user?.timezone ?? 'UTC'
    const localDate = new Date()
      .toLocaleString('en-CA', { timeZone: tz })
      .split(',')[0] // YYYY-MM-DD

    return await ctx.db
      .query('briefs')
      .withIndex('by_user_date', q =>
        q.eq('userId', userId).eq('forDate', localDate),
      )
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

export const readContext = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .first()

    const teamId = user?.teamId ? (user.teamId as string) : 'default-team'
    const yesterdayStart = Date.now() - 24 * 60 * 60 * 1000

    const rawEvents = await ctx.db
      .query('activityEvents')
      .withIndex('by_team_ts', q =>
        q.eq('teamId', teamId).gte('ts', yesterdayStart),
      )
      .take(500)

    // Enrich events with channel kind if event is message/channel related
    const events = await Promise.all(
      rawEvents.map(async e => {
        if (e.refType === 'channel') {
          const chanId = ctx.db.normalizeId('channels', e.refId)
          if (!chanId) return e
          const doc = await ctx.db.get(chanId)
          const channel = doc as Doc<'channels'> | null
          if (channel) {
            return {
              ...e,
              payload: {
                ...(typeof e.payload === 'object' && e.payload ? e.payload : {}),
                channelKind: channel.kind ?? (channel.isPrivate ? 'private' : 'public'),
                channelName: channel.name,
                isDirectRecipient: channel.kind === 'dm' && channel.memberIds.includes(args.userId),
              },
            }
          }
        } else if (e.refType === 'message') {
          const msgId = ctx.db.normalizeId('messages', e.refId)
          if (!msgId) return e
          const msgDoc = await ctx.db.get(msgId)
          const msg = msgDoc as Doc<'messages'> | null
          if (msg && msg.channelId) {
            const chanDoc = await ctx.db.get(msg.channelId)
            const channel = chanDoc as Doc<'channels'> | null
            if (channel) {
              return {
                ...e,
                payload: {
                  ...(typeof e.payload === 'object' && e.payload ? e.payload : {}),
                  channelKind: channel.kind ?? (channel.isPrivate ? 'private' : 'public'),
                  channelName: channel.name,
                  isDirectRecipient: channel.kind === 'dm' && channel.memberIds.includes(args.userId),
                },
              }
            }
          }
        }
        return e
      })
    )

    const myTickets = await ctx.db
      .query('tickets')
      .withIndex('by_assignee', q => q.eq('assigneeId', args.userId))
      .filter(f => f.neq(f.field('status'), 'done'))
      .take(50)

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
      .withIndex('by_user_date', q =>
        q.eq('userId', args.userId).eq('forDate', args.forDate),
      )
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
