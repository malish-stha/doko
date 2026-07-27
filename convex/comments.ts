import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { appendActivityEvent } from './events'

export const byTicket = query({
  args: { ticketId: v.id('tickets') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('comments')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .order('asc')
      .collect()
  },
})

export const add = mutation({
  args: {
    ticketId: v.id('tickets'),
    body: v.string(),
    authorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.body.trim()) throw new Error('empty comment')
    const ticket = await ctx.db.get(args.ticketId)
    if (!ticket) throw new Error('ticket not found')

    const identity = await ctx.auth.getUserIdentity()
    const authorId =
      args.authorName ??
      identity?.name ??
      identity?.email ??
      identity?.subject ??
      'dev-user'

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
      },
    })

    return id
  },
})
