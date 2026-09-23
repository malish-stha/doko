import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Ctx, assertTicketInTeam, authError, requireTeam } from './teamHelper'
import { appendActivityEvent } from './events'
import { notifyWatchers } from './watchers'
import { touchTicket } from './tickets'
import { Doc, Id } from './_generated/dataModel'

const MAX_TITLE = 300

async function loadSubtaskInTeam(ctx: Ctx, subtaskId: Id<'subtasks'>, teamId: Id<'teams'>): Promise<Doc<'subtasks'>> {
  const st = await ctx.db.get(subtaskId)
  if (!st) throw authError('NOT_FOUND', 'Subtask not found.')
  await assertTicketInTeam(ctx, st.ticketId, teamId)
  return st
}

function cleanTitle(raw: string) {
  const title = raw.trim()
  if (!title) throw authError('FORBIDDEN', 'Subtask title is required.')
  return title.slice(0, MAX_TITLE)
}

export const byTicket = query({
  args: { ticketId: v.id('tickets') },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    await assertTicketInTeam(ctx, args.ticketId, teamId)
    const rows = await ctx.db
      .query('subtasks')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .collect()
    return rows.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
  },
})

export const add = mutation({
  args: {
    ticketId: v.id('tickets'),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    await assertTicketInTeam(ctx, args.ticketId, teamId)
    const title = cleanTitle(args.title)

    const existing = await ctx.db
      .query('subtasks')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .collect()
    const maxOrder = existing.reduce((m, s) => Math.max(m, s.order), 0)

    const id = await ctx.db.insert('subtasks', {
      ticketId: args.ticketId,
      title,
      done: false,
      order: maxOrder + 1,
      createdAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'subtask.added',
      refType: 'subtask',
      refId: id,
      ticketId: args.ticketId,
      payload: { ticketId: args.ticketId, title },
    })

    await notifyWatchers(ctx, args.ticketId, userId, 'subtask.added', { title })
    await touchTicket(ctx, args.ticketId)

    return id
  },
})

export const toggle = mutation({
  args: { subtaskId: v.id('subtasks') },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const st = await loadSubtaskInTeam(ctx, args.subtaskId, teamId)

    const nextDone = !st.done
    await ctx.db.patch(args.subtaskId, { done: nextDone })

    const kind = nextDone ? 'subtask.checked' : 'subtask.unchecked'
    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind,
      refType: 'subtask',
      refId: args.subtaskId,
      ticketId: st.ticketId,
      payload: { ticketId: st.ticketId, title: st.title },
    })

    await notifyWatchers(ctx, st.ticketId, userId, kind, { title: st.title })
    await touchTicket(ctx, st.ticketId)
  },
})

export const rename = mutation({
  args: {
    subtaskId: v.id('subtasks'),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const st = await loadSubtaskInTeam(ctx, args.subtaskId, teamId)
    const title = cleanTitle(args.title)
    if (title === st.title) return

    await ctx.db.patch(args.subtaskId, { title })
    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'subtask.renamed',
      refType: 'subtask',
      refId: args.subtaskId,
      ticketId: st.ticketId,
      payload: { ticketId: st.ticketId, from: st.title, title },
    })
    await touchTicket(ctx, st.ticketId)
  },
})

export const remove = mutation({
  args: { subtaskId: v.id('subtasks') },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const st = await loadSubtaskInTeam(ctx, args.subtaskId, teamId)

    await ctx.db.delete(args.subtaskId)

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'subtask.removed',
      refType: 'subtask',
      refId: args.subtaskId,
      ticketId: st.ticketId,
      payload: { ticketId: st.ticketId, title: st.title },
    })

    await notifyWatchers(ctx, st.ticketId, userId, 'subtask.removed', { title: st.title })
    await touchTicket(ctx, st.ticketId)
  },
})

/**
 * Persists a full ordering for one ticket's subtasks. Every subtask of the
 * ticket must appear exactly once, so no two rows can share an order value.
 */
export const reorder = mutation({
  args: {
    ticketId: v.id('tickets'),
    orderedIds: v.array(v.id('subtasks')),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    await assertTicketInTeam(ctx, args.ticketId, teamId)

    const existing = await ctx.db
      .query('subtasks')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .collect()
    const existingIds = new Set(existing.map(s => s._id))
    const provided = new Set(args.orderedIds)
    if (provided.size !== args.orderedIds.length || provided.size !== existingIds.size) {
      throw authError('FORBIDDEN', 'Ordering must list every subtask exactly once.')
    }
    for (const id of args.orderedIds) {
      if (!existingIds.has(id)) throw authError('NOT_FOUND', 'Subtask does not belong to this ticket.')
    }

    const byId = new Map(existing.map(s => [s._id, s]))
    for (const [index, id] of args.orderedIds.entries()) {
      if (byId.get(id)!.order !== index + 1) await ctx.db.patch(id, { order: index + 1 })
    }

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'subtask.reordered',
      refType: 'ticket',
      refId: args.ticketId,
      ticketId: args.ticketId,
      payload: { ticketId: args.ticketId, count: args.orderedIds.length },
    })
    await touchTicket(ctx, args.ticketId)
  },
})
