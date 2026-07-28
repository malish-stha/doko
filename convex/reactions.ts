import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { appendActivityEvent } from './events'
import { requireTeam } from './teamHelper'

export const byMessage = query({
  args: { messageId: v.id('messages') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('reactions')
      .withIndex('by_message', q => q.eq('messageId', args.messageId))
      .collect()
  },
})

export const toggle = mutation({
  args: { messageId: v.id('messages'), emoji: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx)

    const existing = await ctx.db
      .query('reactions')
      .withIndex('by_message', q => q.eq('messageId', args.messageId))
      .filter(f =>
        f.and(
          f.eq(f.field('userId'), userId),
          f.eq(f.field('emoji'), args.emoji),
        ),
      )
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
    } else {
      const id = await ctx.db.insert('reactions', {
        messageId: args.messageId,
        userId,
        emoji: args.emoji,
        createdAt: Date.now(),
      })

      await appendActivityEvent(ctx, {
        kind: 'reaction.added',
        refType: 'reaction',
        refId: id,
        payload: { messageId: args.messageId, emoji: args.emoji },
      })
    }
  },
})
