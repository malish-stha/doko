import { v } from 'convex/values'
import { mutation, query, MutationCtx } from './_generated/server'
import { requireTeam } from './teamHelper'
import { appendActivityEvent } from './events'
import { Id } from './_generated/dataModel'

export const isWatching = query({
  args: { ticketId: v.id('tickets'), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId, identity } = await requireTeam(ctx, args.userEmail)
    const watchers = await ctx.db
      .query('watchers')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .collect()

    const email = (identity?.email ?? args.userEmail)?.trim().toLowerCase()
    return watchers.some(
      w => w.userId === userId || (email && w.userId.trim().toLowerCase() === email),
    )
  },
})


export const forTicket = query({
  args: { ticketId: v.id('tickets'), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireTeam(ctx, args.userEmail)
    const watchers = await ctx.db
      .query('watchers')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .collect()

    const users = await ctx.db.query('users').collect()
    const userMap = new Map(users.map(u => [u.userId, u]))
    const userEmailMap = new Map(users.map(u => [u.email.toLowerCase(), u]))

    return watchers.map(w => {
      const u = userMap.get(w.userId) ?? userEmailMap.get(w.userId.toLowerCase())
      return {
        ...w,
        userName: u ? u.name || u.email.split('@')[0] : w.userId,
        userEmail: u ? u.email : w.userId.includes('@') ? w.userId : '',
        avatarUrl: u?.avatarUrl,
      }
    })
  },
})

export const subscribe = mutation({
  args: { ticketId: v.id('tickets'), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)
    const existing = await ctx.db
      .query('watchers')
      .withIndex('by_ticket_user', q => q.eq('ticketId', args.ticketId).eq('userId', userId))
      .first()
    if (existing) return existing._id

    const id = await ctx.db.insert('watchers', {
      ticketId: args.ticketId,
      userId,
      subscribedAt: Date.now(),
    })

    await appendActivityEvent(
      ctx,
      {
        kind: 'ticket.watched',
        refType: 'ticket',
        refId: args.ticketId,
        payload: { ticketId: args.ticketId, watcherId: userId },
      },
      args.userEmail,
    )

    return id
  },
})

export const unsubscribe = mutation({
  args: { ticketId: v.id('tickets'), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)
    const existing = await ctx.db
      .query('watchers')
      .withIndex('by_ticket_user', q => q.eq('ticketId', args.ticketId).eq('userId', userId))
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
      await appendActivityEvent(
        ctx,
        {
          kind: 'ticket.unwatched',
          refType: 'ticket',
          refId: args.ticketId,
          payload: { ticketId: args.ticketId, watcherId: userId },
        },
        args.userEmail,
      )
    }
  },
})


export async function ensureWatcher(ctx: MutationCtx, ticketId: Id<'tickets'>, userId: string) {
  if (!userId) return
  const existing = await ctx.db
    .query('watchers')
    .withIndex('by_ticket_user', q => q.eq('ticketId', ticketId).eq('userId', userId))
    .first()
  if (!existing) {
    await ctx.db.insert('watchers', {
      ticketId,
      userId,
      subscribedAt: Date.now(),
    })
  }
}

export async function notifyWatchers(
  ctx: MutationCtx,
  ticketId: Id<'tickets'>,
  actorUserId: string,
  kind: string,
  payload?: any,
) {
  const watchers = await ctx.db
    .query('watchers')
    .withIndex('by_ticket', q => q.eq('ticketId', ticketId))
    .collect()

  const now = Date.now()
  for (const watcher of watchers) {
    if (watcher.userId === actorUserId) continue
    await ctx.db.insert('mentions', {
      contextRefType: 'ticket',
      contextRefId: ticketId,
      mentionedUserId: watcher.userId,
      mentionedByUserId: actorUserId,
      read: false,
      createdAt: now,
    })
  }
}
