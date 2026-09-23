import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Ctx, assertTicketInTeam, authError, requireTeam } from './teamHelper'
import { appendActivityEvent } from './events'
import { notifyWatchers } from './watchers'
import { touchTicket } from './tickets'
import { Doc, Id } from './_generated/dataModel'

type LinkType = Doc<'ticketLinks'>['type']

const REVERSE: Record<LinkType, LinkType> = {
  blocks: 'blocked_by',
  blocked_by: 'blocks',
  relates_to: 'relates_to',
  duplicates: 'duplicated_by',
  duplicated_by: 'duplicates',
}

const LINK_TYPE = v.union(
  v.literal('blocks'),
  v.literal('blocked_by'),
  v.literal('relates_to'),
  v.literal('duplicates'),
  v.literal('duplicated_by'),
)

const MAX_CYCLE_VISITS = 500

/** Would adding `source blocks target` create a cycle? Bounded DFS over `blocks` edges. */
async function wouldCreateBlockCycle(ctx: Ctx, source: Id<'tickets'>, target: Id<'tickets'>) {
  // A cycle exists if target already (transitively) blocks source.
  const stack: Id<'tickets'>[] = [target]
  const seen = new Set<string>()
  let visits = 0
  while (stack.length) {
    const current = stack.pop()!
    if (current === source) return true
    if (seen.has(current)) continue
    seen.add(current)
    if (++visits > MAX_CYCLE_VISITS) {
      throw authError('FORBIDDEN', 'Dependency graph too large to validate; simplify the links first.')
    }
    const edges = await ctx.db
      .query('ticketLinks')
      .withIndex('by_source', q => q.eq('sourceId', current))
      .collect()
    for (const e of edges) if (e.type === 'blocks') stack.push(e.targetId)
  }
  return false
}

async function findLink(ctx: Ctx, sourceId: Id<'tickets'>, targetId: Id<'tickets'>, type: LinkType) {
  return await ctx.db
    .query('ticketLinks')
    .withIndex('by_source_target_type', q => q.eq('sourceId', sourceId).eq('targetId', targetId).eq('type', type))
    .collect()
}

export const create = mutation({
  args: {
    sourceId: v.id('tickets'),
    targetId: v.id('tickets'),
    type: LINK_TYPE,
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    if (args.sourceId === args.targetId) throw authError('FORBIDDEN', 'A ticket cannot link to itself.')

    const sourceTicket = await assertTicketInTeam(ctx, args.sourceId, teamId)
    const targetTicket = await assertTicketInTeam(ctx, args.targetId, teamId)

    if ((await findLink(ctx, args.sourceId, args.targetId, args.type)).length > 0) {
      throw authError('FORBIDDEN', 'That link already exists.')
    }

    // Contradictory pair: "A blocks B" while "A blocked_by B" already exists.
    const inverse = REVERSE[args.type]
    if (inverse !== args.type && (await findLink(ctx, args.sourceId, args.targetId, inverse)).length > 0) {
      throw authError('FORBIDDEN', `Conflicts with the existing "${inverse.replace('_', ' ')}" link.`)
    }

    if (args.type === 'blocks' && (await wouldCreateBlockCycle(ctx, args.sourceId, args.targetId))) {
      throw authError('FORBIDDEN', `${targetTicket.key} already blocks ${sourceTicket.key} (directly or indirectly).`)
    }
    if (args.type === 'blocked_by' && (await wouldCreateBlockCycle(ctx, args.targetId, args.sourceId))) {
      throw authError('FORBIDDEN', `${sourceTicket.key} already blocks ${targetTicket.key} (directly or indirectly).`)
    }

    const now = Date.now()
    const primaryId = await ctx.db.insert('ticketLinks', {
      sourceId: args.sourceId,
      targetId: args.targetId,
      type: args.type,
      createdAt: now,
      createdBy: userId,
    })

    if ((await findLink(ctx, args.targetId, args.sourceId, inverse)).length === 0) {
      await ctx.db.insert('ticketLinks', {
        sourceId: args.targetId,
        targetId: args.sourceId,
        type: inverse,
        createdAt: now,
        createdBy: userId,
      })
    }

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'ticket.linked',
      refType: 'ticketLink',
      refId: primaryId,
      ticketId: args.sourceId,
      payload: {
        sourceId: args.sourceId,
        sourceKey: sourceTicket.key,
        targetId: args.targetId,
        targetKey: targetTicket.key,
        type: args.type,
      },
    })
    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'ticket.linked',
      refType: 'ticketLink',
      refId: primaryId,
      ticketId: args.targetId,
      payload: {
        sourceId: args.targetId,
        sourceKey: targetTicket.key,
        targetId: args.sourceId,
        targetKey: sourceTicket.key,
        type: inverse,
      },
    })

    await notifyWatchers(ctx, args.sourceId, userId, 'ticket.linked', { targetKey: targetTicket.key, type: args.type })
    await notifyWatchers(ctx, args.targetId, userId, 'ticket.linked', { sourceKey: sourceTicket.key, type: inverse })

    await touchTicket(ctx, args.sourceId)
    await touchTicket(ctx, args.targetId)

    return primaryId
  },
})

export const forTicket = query({
  args: { ticketId: v.id('tickets') },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    await assertTicketInTeam(ctx, args.ticketId, teamId)
    const outgoing = await ctx.db
      .query('ticketLinks')
      .withIndex('by_source', q => q.eq('sourceId', args.ticketId))
      .collect()

    const rows = await Promise.all(
      outgoing.map(async link => {
        const target = await ctx.db.get(link.targetId)
        if (!target || target.teamId !== (teamId as string)) return null
        return {
          link,
          target: {
            _id: target._id,
            key: target.key,
            title: target.title,
            status: target.status,
            type: target.type,
            priority: target.priority,
          },
        }
      }),
    )
    return rows.filter((r): r is NonNullable<typeof r> => r !== null)
  },
})

export const remove = mutation({
  args: { linkId: v.id('ticketLinks') },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const link = await ctx.db.get(args.linkId)
    if (!link) throw authError('NOT_FOUND', 'Link not found.')
    await assertTicketInTeam(ctx, link.sourceId, teamId)
    await assertTicketInTeam(ctx, link.targetId, teamId)

    const mirrors = await findLink(ctx, link.targetId, link.sourceId, REVERSE[link.type])
    await ctx.db.delete(args.linkId)
    for (const m of mirrors) await ctx.db.delete(m._id)

    for (const ticketId of [link.sourceId, link.targetId]) {
      await appendActivityEvent(ctx, {
        teamId,
        userId,
        kind: 'ticket.unlinked',
        refType: 'ticketLink',
        refId: args.linkId,
        ticketId,
        payload: { sourceId: link.sourceId, targetId: link.targetId, type: link.type },
      })
    }

    await notifyWatchers(ctx, link.sourceId, userId, 'ticket.unlinked', { type: link.type })
    await notifyWatchers(ctx, link.targetId, userId, 'ticket.unlinked', { type: REVERSE[link.type] })
    await touchTicket(ctx, link.sourceId)
    await touchTicket(ctx, link.targetId)
  },
})
