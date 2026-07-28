import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { appendActivityEvent } from './events'
import { requireTeam } from './teamHelper'

export const byTicket = query({
  args: { ticketId: v.id('tickets'), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query('comments')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .order('asc')
      .collect()

    const users = await ctx.db.query('users').collect()
    const members = await ctx.db.query('teamMembers').collect()

    const userMap = new Map(users.map(u => [u.userId, u]))
    const userEmailMap = new Map(users.map(u => [u.email.toLowerCase(), u]))
    const memberMap = new Map(members.map(m => [m.userId, m]))
    const memberEmailMap = new Map(members.map(m => [m.email.toLowerCase(), m]))

    return comments.map(c => {
      const u =
        userMap.get(c.authorId) ??
        userEmailMap.get(c.authorId.toLowerCase()) ??
        memberMap.get(c.authorId) ??
        memberEmailMap.get(c.authorId.toLowerCase())

      let authorName = c.authorId
      if (u) {
        authorName = 'name' in u && u.name ? u.name : u.email.split('@')[0]
      } else if (c.authorId === 'dev-user' || c.authorId === 'anonymous') {
        authorName = 'Teammate'
      }

      let authorEmail = u ? u.email : c.authorId.includes('@') ? c.authorId : ''
      let authorUserId = u?.userId ?? c.authorId

      return {
        ...c,
        authorName,
        authorEmail,
        authorUserId,
        avatarUrl: u && 'avatarUrl' in u ? u.avatarUrl : undefined,
      }
    })
  },
})

export const add = mutation({
  args: {
    ticketId: v.id('tickets'),
    body: v.string(),
    authorName: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.body.trim()) throw new Error('empty comment')
    const ticket = await ctx.db.get(args.ticketId)
    if (!ticket) throw new Error('ticket not found')

    const { userId, user, identity } = await requireTeam(ctx, args.userEmail)
    const authorId =
      user?.userId ??
      (userId !== 'anonymous' ? userId : undefined) ??
      user?.name ??
      args.authorName ??
      identity?.email ??
      args.userEmail ??
      'Teammate'

    const id = await ctx.db.insert('comments', {
      ticketId: args.ticketId,
      authorId,
      body: args.body.trim(),
      createdAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      kind: 'ticket.commented',
      refType: 'comment',
      refId: id,
      payload: {
        ticketId: args.ticketId,
        ticketKey: ticket.key,
        bodyPreview: args.body.slice(0, 100),
        author: authorId,
      },
    })

    return id
  },
})
