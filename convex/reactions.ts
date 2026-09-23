import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { appendActivityEvent } from './events'
import { authError, requireTeam } from './teamHelper'
import { assertChannelAccess } from './channels'

// One to a few emoji code points (with variation selectors / ZWJ sequences), nothing else.
const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️){1,8}$/u

function cleanEmoji(raw: string) {
  const emoji = raw.trim()
  if (!emoji || emoji.length > 16 || !EMOJI.test(emoji)) {
    throw authError('FORBIDDEN', 'Reactions must be a single emoji.')
  }
  return emoji
}

export const byMessage = query({
  args: { messageId: v.id('messages') },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const message = await ctx.db.get(args.messageId)
    if (!message) return []
    await assertChannelAccess(ctx, message.channelId, teamId, userId)
    return await ctx.db
      .query('reactions')
      .withIndex('by_message', q => q.eq('messageId', args.messageId))
      .collect()
  },
})

export const toggle = mutation({
  args: { messageId: v.id('messages'), emoji: v.string() },
  handler: async (ctx, args) => {
    const emoji = cleanEmoji(args.emoji)
    const { userId, teamId } = await requireTeam(ctx)
    const message = await ctx.db.get(args.messageId)
    if (!message) throw authError('NOT_FOUND', 'Message not found.')
    await assertChannelAccess(ctx, message.channelId, teamId, userId)

    const existing = await ctx.db
      .query('reactions')
      .withIndex('by_message_user_emoji', q =>
        q.eq('messageId', args.messageId).eq('userId', userId).eq('emoji', emoji),
      )
      .collect()

    if (existing.length > 0) {
      // Remove every duplicate row, not just the first one.
      for (const r of existing) await ctx.db.delete(r._id)
      return { reacted: false }
    }

    const id = await ctx.db.insert('reactions', {
      messageId: args.messageId,
      userId,
      emoji,
      createdAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'reaction.added',
      refType: 'reaction',
      refId: id,
      payload: { messageId: args.messageId, emoji },
    })
    return { reacted: true }
  },
})
