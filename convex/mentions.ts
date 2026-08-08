import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTeam } from './teamHelper'
import { Id } from './_generated/dataModel'

export const forMe = query({
  args: { read: v.optional(v.boolean()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)

    let queryBuilder = ctx.db
      .query('mentions')
      .withIndex('by_user', q => q.eq('mentionedUserId', userId))

    if (args.read !== undefined) {
      queryBuilder = ctx.db
        .query('mentions')
        .withIndex('by_user_read', q => q.eq('mentionedUserId', userId).eq('read', args.read!))
    }

    const mentions = await queryBuilder.collect()
    mentions.sort((a, b) => b.createdAt - a.createdAt)

    const users = await ctx.db.query('users').collect()
    const userMap = new Map(users.map(u => [u.userId, u]))
    const userEmailMap = new Map(users.map(u => [u.email.toLowerCase(), u]))

    return await Promise.all(
      mentions.map(async m => {
        const author = userMap.get(m.mentionedByUserId) ?? userEmailMap.get(m.mentionedByUserId.toLowerCase())
        let contextDetail: any = null

        if (m.contextRefType === 'ticket') {
          const t = await ctx.db.get(m.contextRefId as Id<'tickets'>)
          if (t && 'title' in t) {
            contextDetail = { title: t.title, key: t.key, id: t._id }
          }
        } else if (m.contextRefType === 'comment') {
          const comment = await ctx.db.get(m.contextRefId as Id<'comments'>)
          if (comment && 'ticketId' in comment) {
            const ticket = await ctx.db.get(comment.ticketId)
            contextDetail = {
              commentBody: comment.body,
              ticketKey: ticket && 'key' in ticket ? ticket.key : undefined,
              ticketTitle: ticket && 'title' in ticket ? ticket.title : undefined,
              ticketId: comment.ticketId,
            }
          }
        } else if (m.contextRefType === 'message') {
          const msg = await ctx.db.get(m.contextRefId as Id<'messages'>)
          if (msg && 'channelId' in msg) {
            const channel = await ctx.db.get(msg.channelId)
            contextDetail = {
              messageBody: msg.body,
              channelName: channel && 'name' in channel ? channel.name : undefined,
              channelId: msg.channelId,
            }
          }
        }


        return {
          ...m,
          authorName: author ? author.name || author.email.split('@')[0] : m.mentionedByUserId,
          authorAvatar: author?.avatarUrl,
          contextDetail,
        }
      }),
    )
  },
})

export const unreadCount = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)
    const unread = await ctx.db
      .query('mentions')
      .withIndex('by_user_read', q => q.eq('mentionedUserId', userId).eq('read', false))
      .collect()
    return unread.length
  },
})

export const markRead = mutation({
  args: { mentionId: v.id('mentions'), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireTeam(ctx, args.userEmail)
    const mention = await ctx.db.get(args.mentionId)
    if (!mention) throw new Error('mention not found')
    await ctx.db.patch(args.mentionId, { read: true })
  },
})

export const markAllRead = mutation({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)
    const unread = await ctx.db
      .query('mentions')
      .withIndex('by_user_read', q => q.eq('mentionedUserId', userId).eq('read', false))
      .collect()

    for (const m of unread) {
      await ctx.db.patch(m._id, { read: true })
    }
  },
})
