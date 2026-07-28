import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { appendActivityEvent } from './events'
import { requireTeam } from './teamHelper'

export const byTeam = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) return []
    return await ctx.db
      .query('channels')
      .withIndex('by_team', q => q.eq('teamId', teamId as string))
      .collect()
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    isPrivate: v.optional(v.boolean()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) throw new Error('No team')
    if (!args.name.trim()) throw new Error('empty channel name')

    const normalizedName = args.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')

    const id = await ctx.db.insert('channels', {
      teamId: teamId as string,
      name: normalizedName,
      isPrivate: args.isPrivate ?? false,
      memberIds: [userId],
      createdAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      kind: 'channel.created',
      refType: 'channel',
      refId: id,
      payload: { name: normalizedName },
    })

    return id
  },
})
