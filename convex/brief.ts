import { v } from 'convex/values'
import { internalAction, internalMutation, internalQuery, query } from './_generated/server'
import { internal } from './_generated/api'

const DEFAULT_TEAM = 'doko'

export const todayForMe = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity()
    const userId = identity?.subject ?? identity?.name ?? 'dev-user'
    const user = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .first()

    const tz = user?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
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
    const yesterdayStart = Date.now() - 24 * 60 * 60 * 1000
    const events = await ctx.db
      .query('activityEvents')
      .withIndex('by_team_ts', q =>
        q.eq('teamId', DEFAULT_TEAM).gte('ts', yesterdayStart),
      )
      .take(500)

    const myTickets = await ctx.db
      .query('tickets')
      .withIndex('by_assignee', q => q.eq('assigneeId', args.userId))
      .filter(f => f.neq(f.field('status'), 'done'))
      .take(50)

    const user = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .first()

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

    if (existing) return existing._id

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
