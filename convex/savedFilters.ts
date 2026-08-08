import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTeam } from './teamHelper'

export const myFilters = query({
  args: {
    scope: v.union(v.literal('board'), v.literal('list')),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { teamId, userId } = await requireTeam(ctx, args.userEmail)

    const userFilters = await ctx.db
      .query('savedFilters')
      .withIndex('by_user_scope', q => q.eq('userId', userId).eq('scope', args.scope))
      .collect()

    let sharedFilters: typeof userFilters = []
    if (teamId) {
      sharedFilters = await ctx.db
        .query('savedFilters')
        .withIndex('by_team_scope_shared', q =>
          q.eq('teamId', teamId).eq('scope', args.scope).eq('isShared', true),
        )
        .collect()
    }

    // Combine and deduplicate by _id
    const map = new Map<string, (typeof userFilters)[0]>()
    for (const f of userFilters) map.set(f._id, f)
    for (const f of sharedFilters) map.set(f._id, f)

    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    scope: v.union(v.literal('board'), v.literal('list')),
    queryString: v.string(),
    isShared: v.boolean(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { teamId, userId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) throw new Error('No active team found')

    return await ctx.db.insert('savedFilters', {
      teamId,
      userId,
      name: args.name.trim(),
      scope: args.scope,
      queryString: args.queryString,
      isShared: args.isShared,
      createdAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: {
    id: v.id('savedFilters'),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)
    const filter = await ctx.db.get(args.id)
    if (!filter) return
    if (filter.userId !== userId) {
      throw new Error('Unauthorized: only owner can delete filter')
    }
    await ctx.db.delete(args.id)
  },
})

export const share = mutation({
  args: {
    id: v.id('savedFilters'),
    isShared: v.boolean(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)
    const filter = await ctx.db.get(args.id)
    if (!filter) throw new Error('Filter not found')
    if (filter.userId !== userId) {
      throw new Error('Unauthorized: only owner can toggle share status')
    }
    await ctx.db.patch(args.id, { isShared: args.isShared })
  },
})
