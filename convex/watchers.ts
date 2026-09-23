import { v } from 'convex/values'
import { mutation, query, MutationCtx } from './_generated/server'
import { assertTicketInTeam, normalizeEmail, requireTeam } from './teamHelper'
import { appendActivityEvent } from './events'
import { Id } from './_generated/dataModel'

export const isWatching = query({
  args: { ticketId: v.id('tickets') },
  handler: async (ctx, args) => {
    const { userId, email, teamId } = await requireTeam(ctx)
    await assertTicketInTeam(ctx, args.ticketId, teamId)
    const watchers = await ctx.db
      .query('watchers')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .collect()

    return watchers.some(w => w.userId === userId || normalizeEmail(w.userId) === email)
  },
})

export const forTicket = query({
  args: { ticketId: v.id('tickets') },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    await assertTicketInTeam(ctx, args.ticketId, teamId)
    const watchers = await ctx.db
      .query('watchers')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .collect()

    return await Promise.all(
      watchers.map(async w => {
        const u =
          (await ctx.db.query('users').withIndex('by_userId', q => q.eq('userId', w.userId)).first()) ??
          (await ctx.db.query('users').withIndex('by_email', q => q.eq('email', normalizeEmail(w.userId))).first())
        return {
          ...w,
          userName: u ? u.name || u.email.split('@')[0] : w.userId,
          userEmail: u ? u.email : w.userId.includes('@') ? w.userId : '',
          avatarUrl: u?.avatarUrl,
        }
      }),
    )
  },
})

export const subscribe = mutation({
  args: { ticketId: v.id('tickets') },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    await assertTicketInTeam(ctx, args.ticketId, teamId)
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

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'ticket.watched',
      refType: 'ticket',
      refId: args.ticketId,
      ticketId: args.ticketId,
      payload: { ticketId: args.ticketId, watcherId: userId },
    })

    return id
  },
})

export const unsubscribe = mutation({
  args: { ticketId: v.id('tickets') },
  handler: async (ctx, args) => {
    const { userId, email, teamId } = await requireTeam(ctx)
    await assertTicketInTeam(ctx, args.ticketId, teamId)
    const rows = await ctx.db
      .query('watchers')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .collect()
    // Same match rule as isWatching, so legacy email-keyed rows can be removed too.
    const mine = rows.filter(w => w.userId === userId || normalizeEmail(w.userId) === email)
    if (mine.length === 0) return

    for (const w of mine) await ctx.db.delete(w._id)
    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'ticket.unwatched',
      refType: 'ticket',
      refId: args.ticketId,
      ticketId: args.ticketId,
      payload: { ticketId: args.ticketId, watcherId: userId },
    })
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

/**
 * Notifies every watcher of `ticketId` except the actor and anyone in
 * `exclude` (e.g. users already notified via an @mention in the same action).
 */
export async function notifyWatchers(
  ctx: MutationCtx,
  ticketId: Id<'tickets'>,
  actorUserId: string,
  kind: string,
  payload?: Record<string, unknown>,
  exclude: Iterable<string> = [],
) {
  void kind
  void payload
  const skip = new Set<string>([actorUserId, ...exclude])
  const watchers = await ctx.db
    .query('watchers')
    .withIndex('by_ticket', q => q.eq('ticketId', ticketId))
    .collect()

  const now = Date.now()
  for (const watcher of watchers) {
    if (skip.has(watcher.userId)) continue
    // One unread row per (watcher, ticket): repeated activity bumps it instead of piling up.
    const existing = await ctx.db
      .query('mentions')
      .withIndex('by_user_context', q =>
        q.eq('mentionedUserId', watcher.userId).eq('contextRefType', 'ticket').eq('contextRefId', ticketId),
      )
      .filter(f => f.eq(f.field('read'), false))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, {
        mentionedByUserId: actorUserId,
        createdAt: now,
        count: (existing.count ?? 1) + 1,
      })
      continue
    }
    await ctx.db.insert('mentions', {
      contextRefType: 'ticket',
      contextRefId: ticketId,
      mentionedUserId: watcher.userId,
      mentionedByUserId: actorUserId,
      read: false,
      count: 1,
      createdAt: now,
    })
  }
}
