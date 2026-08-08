import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTeam } from './teamHelper'
import { appendActivityEvent } from './events'
import { notifyWatchers } from './watchers'
import { touchTicket } from './tickets'


const REVERSE: Record<string, string> = {
  blocks: 'blocked_by',
  blocked_by: 'blocks',
  relates_to: 'relates_to',
  duplicates: 'duplicated_by',
  duplicated_by: 'duplicates',
}

export const create = mutation({
  args: {
    sourceId: v.id('tickets'),
    targetId: v.id('tickets'),
    type: v.string(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)

    if (args.sourceId === args.targetId) {
      throw new Error('cannot link ticket to itself')
    }
    if (!(args.type in REVERSE)) {
      throw new Error('invalid link type')
    }

    const existing = await ctx.db
      .query('ticketLinks')
      .withIndex('by_source_target_type', q =>
        q.eq('sourceId', args.sourceId).eq('targetId', args.targetId).eq('type', args.type as any),
      )
      .first()

    if (existing) throw new Error('link already exists')

    const now = Date.now()
    const primaryId = await ctx.db.insert('ticketLinks', {
      sourceId: args.sourceId,
      targetId: args.targetId,
      type: args.type as any,
      createdAt: now,
      createdBy: userId,
    })

    await ctx.db.insert('ticketLinks', {
      sourceId: args.targetId,
      targetId: args.sourceId,
      type: REVERSE[args.type] as any,
      createdAt: now,
      createdBy: userId,
    })

    const sourceTicket = await ctx.db.get(args.sourceId)
    const targetTicket = await ctx.db.get(args.targetId)

    await appendActivityEvent(
      ctx,
      {
        kind: 'ticket.linked',
        refType: 'ticketLink',
        refId: primaryId,
        payload: {
          sourceId: args.sourceId,
          sourceKey: sourceTicket?.key,
          targetId: args.targetId,
          targetKey: targetTicket?.key,
          type: args.type,
        },
      },
      args.userEmail,
    )


    await notifyWatchers(ctx, args.sourceId, userId, 'ticket.linked', {
      targetKey: targetTicket?.key,
      type: args.type,
    })
    await notifyWatchers(ctx, args.targetId, userId, 'ticket.linked', {
      sourceKey: sourceTicket?.key,
      type: REVERSE[args.type],
    })

    await touchTicket(ctx, args.sourceId)
    await touchTicket(ctx, args.targetId)

    return primaryId
  },
})

export const forTicket = query({
  args: { ticketId: v.id('tickets'), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireTeam(ctx, args.userEmail)
    const outgoing = await ctx.db
      .query('ticketLinks')
      .withIndex('by_source', q => q.eq('sourceId', args.ticketId))
      .collect()

    return await Promise.all(
      outgoing.map(async link => {
        const target = await ctx.db.get(link.targetId)
        return {
          link,
          target,
        }
      }),
    )
  },
})

export const remove = mutation({
  args: {
    linkId: v.id('ticketLinks'),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)
    const link = await ctx.db.get(args.linkId)
    if (!link) throw new Error('link not found')

    const reverse = await ctx.db
      .query('ticketLinks')
      .withIndex('by_source_target_type', q =>
        q.eq('sourceId', link.targetId).eq('targetId', link.sourceId).eq('type', REVERSE[link.type] as any),
      )
      .first()

    await ctx.db.delete(args.linkId)
    if (reverse) await ctx.db.delete(reverse._id)

    await appendActivityEvent(
      ctx,
      {
        kind: 'ticket.unlinked',
        refType: 'ticketLink',
        refId: args.linkId,
        payload: {
          sourceId: link.sourceId,
          targetId: link.targetId,
          type: link.type,
        },
      },
      args.userEmail,
    )


    await notifyWatchers(ctx, link.sourceId, userId, 'ticket.unlinked', { type: link.type })
    await notifyWatchers(ctx, link.targetId, userId, 'ticket.unlinked', { type: REVERSE[link.type] })
    await touchTicket(ctx, link.sourceId)
    await touchTicket(ctx, link.targetId)
  },
})

