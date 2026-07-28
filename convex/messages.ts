import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { appendActivityEvent } from './events'
import { requireTeam } from './teamHelper'

export const byChannel = query({
  args: { channelId: v.id('channels'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50
    const msgs = await ctx.db
      .query('messages')
      .withIndex('by_channel_created', q => q.eq('channelId', args.channelId))
      .order('desc')
      .take(limit)

    return msgs.reverse()
  },
})

export const threadReplies = query({
  args: { rootId: v.id('messages') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('messages')
      .withIndex('by_thread', q => q.eq('threadRootId', args.rootId))
      .order('asc')
      .collect()
  },
})

export const send = mutation({
  args: {
    channelId: v.id('channels'),
    body: v.string(),
    authorName: v.optional(v.string()),
    threadRootId: v.optional(v.id('messages')),
  },
  handler: async (ctx, args) => {
    if (!args.body.trim()) throw new Error('empty message')

    const { userId, user, identity } = await requireTeam(ctx)
    const authorId =
      args.authorName ??
      user?.name ??
      identity?.name ??
      identity?.email ??
      userId

    const id = await ctx.db.insert('messages', {
      channelId: args.channelId,
      authorId,
      body: args.body.trim(),
      threadRootId: args.threadRootId,
      createdAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      kind: 'message.posted',
      refType: 'message',
      refId: id,
      payload: {
        channelId: args.channelId,
        bodyPreview: args.body.slice(0, 100),
        thread: Boolean(args.threadRootId),
      },
    })

    return id
  },
})
