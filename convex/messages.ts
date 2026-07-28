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

    const users = await ctx.db.query('users').collect()
    const userMap = new Map(users.map(u => [u.userId, u]))
    const userEmailMap = new Map(users.map(u => [u.email.toLowerCase(), u]))
    const userNameMap = new Map(users.map(u => [u.name.toLowerCase(), u]))

    const enriched = msgs.map(m => {
      const u =
        userMap.get(m.authorId) ??
        userEmailMap.get(m.authorId.toLowerCase()) ??
        userNameMap.get(m.authorId.toLowerCase())

      return {
        ...m,
        avatarUrl: u?.avatarUrl,
        authorEmail: u?.email,
        authorName: u?.name ?? m.authorId,
      }
    })

    return enriched.reverse()
  },
})

export const threadReplies = query({
  args: { rootId: v.id('messages') },
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query('messages')
      .withIndex('by_thread', q => q.eq('threadRootId', args.rootId))
      .order('asc')
      .collect()

    const users = await ctx.db.query('users').collect()
    const userMap = new Map(users.map(u => [u.userId, u]))
    const userEmailMap = new Map(users.map(u => [u.email.toLowerCase(), u]))

    return msgs.map(m => {
      const u = userMap.get(m.authorId) ?? userEmailMap.get(m.authorId.toLowerCase())
      return {
        ...m,
        avatarUrl: u?.avatarUrl,
        authorEmail: u?.email,
        authorName: u?.name ?? m.authorId,
      }
    })
  },
})

export const send = mutation({
  args: {
    channelId: v.id('channels'),
    body: v.string(),
    authorName: v.optional(v.string()),
    threadRootId: v.optional(v.id('messages')),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.body.trim()) throw new Error('empty message')

    const { userId, user, identity } = await requireTeam(ctx, args.userEmail)
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
