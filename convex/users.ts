import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const me = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity()
    const userId = identity?.subject ?? identity?.name ?? 'dev-user'
    return await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .first()
  },
})

export const upsert = mutation({
  args: { timezone: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    const userId = identity?.subject ?? identity?.name ?? 'dev-user'
    const email = identity?.email ?? 'dev@doko.internal'
    const name = identity?.name ?? identity?.email ?? 'Dev User'

    const existing = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { timezone: args.timezone })
      return existing._id
    }

    return await ctx.db.insert('users', {
      userId,
      email,
      name,
      timezone: args.timezone,
      createdAt: Date.now(),
    })
  },
})
