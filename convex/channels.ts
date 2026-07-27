import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { appendActivityEvent } from './events'

const DEFAULT_TEAM = 'doko'

export const byTeam = query({
  args: {},
  handler: async ctx => {
    return await ctx.db
      .query('channels')
      .withIndex('by_team', q => q.eq('teamId', DEFAULT_TEAM))
      .collect()
  },
})

export const create = mutation({
  args: { name: v.string(), isPrivate: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    const memberId = identity?.subject ?? identity?.name ?? 'dev-user'

    if (!args.name.trim()) throw new Error('empty channel name')

    const normalizedName = args.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')

    const id = await ctx.db.insert('channels', {
      teamId: DEFAULT_TEAM,
      name: normalizedName,
      isPrivate: args.isPrivate ?? false,
      memberIds: [memberId],
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
