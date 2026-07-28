import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const me = query({
  args: { email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    const email = identity?.email ?? args.email
    if (!email) return null
    const key = identity?.subject ?? email.trim().toLowerCase()
    return await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', key))
      .first()
  },
})

export const upsert = mutation({
  args: {
    timezone: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    const rawEmail = identity?.email ?? args.email
    if (!rawEmail) return null
    const email = rawEmail.trim().toLowerCase()
    const userId = identity?.subject ?? email
    const name = identity?.name ?? args.name ?? email

    const existing = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { timezone: args.timezone, email, name })
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
