import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertTicketInTeam, authError, requireRole, requireTeam } from './teamHelper'
import { appendActivityEvent } from './events'
import { activeSprintFor, recomputePlannedPoints, sumStoryPoints } from './sprintHelper'

const MIN_DURATION_DAYS = 1
const MAX_DURATION_DAYS = 90

export const listForTeam = query({
  args: {
    status: v.optional(v.union(v.literal('planning'), v.literal('active'), v.literal('completed'))),
  },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    const rows = args.status
      ? await ctx.db
          .query('sprints')
          .withIndex('by_team_status', q => q.eq('teamId', teamId).eq('status', args.status!))
          .collect()
      : await ctx.db
          .query('sprints')
          .withIndex('by_team', q => q.eq('teamId', teamId))
          .collect()
    // Same ordering whichever branch ran: newest first.
    return rows.sort((a, b) => b.createdAt - a.createdAt)
  },
})

export const activeSprint = query({
  args: {},
  handler: async ctx => {
    const { teamId } = await requireTeam(ctx)
    return await activeSprintFor(ctx, teamId)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    goal: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const name = args.name.trim()
    if (!name) throw authError('FORBIDDEN', 'Sprint name is required.')

    const id = await ctx.db.insert('sprints', {
      teamId,
      name,
      goal: args.goal?.trim() || undefined,
      status: 'planning',
      createdAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'sprint.created',
      refType: 'sprint',
      refId: id,
      payload: { name },
    })

    return id
  },
})

/** Owners and admins start sprints; only one may be active per team. */
export const start = mutation({
  args: {
    sprintId: v.id('sprints'),
    durationDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireRole(ctx, ['owner', 'admin'])
    const sprint = await ctx.db.get(args.sprintId)
    if (!sprint || sprint.teamId !== teamId) throw authError('NOT_FOUND', 'Sprint not found.')
    if (sprint.status !== 'planning') {
      throw authError('FORBIDDEN', 'Sprint is not in planning state.')
    }

    const otherActive = await activeSprintFor(ctx, teamId)
    if (otherActive) {
      throw authError('FORBIDDEN', `Another sprint is active: ${otherActive.name}`)
    }

    const requested = Math.floor(args.durationDays ?? 14)
    if (!Number.isFinite(requested) || requested < MIN_DURATION_DAYS || requested > MAX_DURATION_DAYS) {
      throw authError('FORBIDDEN', `Sprint length must be between ${MIN_DURATION_DAYS} and ${MAX_DURATION_DAYS} days.`)
    }

    const plannedPoints = await sumStoryPoints(ctx, args.sprintId)
    const now = Date.now()
    const endDate = now + requested * 24 * 60 * 60 * 1000

    await ctx.db.patch(args.sprintId, {
      status: 'active',
      startDate: now,
      endDate,
      plannedPoints,
    })

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'sprint.started',
      refType: 'sprint',
      refId: args.sprintId,
      payload: { durationDays: requested, plannedPoints },
    })
  },
})

/**
 * Completes the active sprint. Unfinished tickets roll over to the backlog
 * or to another (non-completed, same-team) sprint. The planned endDate is
 * preserved; completedAt records when it actually closed.
 */
export const complete = mutation({
  args: {
    sprintId: v.id('sprints'),
    rollover: v.optional(v.union(v.literal('backlog'), v.id('sprints'))),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireRole(ctx, ['owner', 'admin'])
    const sprint = await ctx.db.get(args.sprintId)
    if (!sprint || sprint.teamId !== teamId) throw authError('NOT_FOUND', 'Sprint not found.')
    if (sprint.status !== 'active') throw authError('FORBIDDEN', 'Sprint is not active.')

    const rolloverTarget = args.rollover ?? 'backlog'
    if (rolloverTarget !== 'backlog') {
      if (rolloverTarget === args.sprintId) {
        throw authError('FORBIDDEN', 'Cannot roll tickets over into the sprint being completed.')
      }
      const target = await ctx.db.get(rolloverTarget)
      if (!target || target.teamId !== teamId) throw authError('NOT_FOUND', 'Rollover sprint not found.')
      if (target.status === 'completed') {
        throw authError('FORBIDDEN', 'Cannot roll tickets over into a completed sprint.')
      }
    }

    const incomplete = await ctx.db
      .query('tickets')
      .withIndex('by_sprint', q => q.eq('sprintId', args.sprintId))
      .filter(f => f.neq(f.field('status'), 'done'))
      .collect()

    for (const t of incomplete) {
      await ctx.db.patch(t._id, {
        sprintId: rolloverTarget === 'backlog' ? undefined : rolloverTarget,
        updatedAt: Date.now(),
      })
    }

    await ctx.db.patch(args.sprintId, {
      status: 'completed',
      completedAt: Date.now(),
    })
    if (rolloverTarget !== 'backlog') await recomputePlannedPoints(ctx, rolloverTarget)

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'sprint.completed',
      refType: 'sprint',
      refId: args.sprintId,
      payload: { rolledOver: incomplete.length, rollover: rolloverTarget },
    })
  },
})

export const moveTicket = mutation({
  args: {
    ticketId: v.id('tickets'),
    sprintId: v.union(v.id('sprints'), v.null()),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const ticket = await assertTicketInTeam(ctx, args.ticketId, teamId)
    if (ticket.type === 'epic') throw authError('FORBIDDEN', 'Epics are not sprint-scoped.')

    if (args.sprintId) {
      const sprint = await ctx.db.get(args.sprintId)
      if (!sprint || sprint.teamId !== teamId) throw authError('NOT_FOUND', 'Sprint not found.')
      if (sprint.status === 'completed') {
        throw authError('FORBIDDEN', 'Cannot add tickets to a completed sprint.')
      }
    }

    const nextSprintId = args.sprintId ?? undefined
    if (ticket.sprintId === nextSprintId) return

    await ctx.db.patch(args.ticketId, { sprintId: nextSprintId, updatedAt: Date.now() })
    await recomputePlannedPoints(ctx, ticket.sprintId)
    await recomputePlannedPoints(ctx, nextSprintId)

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'ticket.moved_sprint',
      refType: 'ticket',
      refId: args.ticketId,
      ticketId: args.ticketId,
      payload: { sprintId: args.sprintId, from: ticket.sprintId ?? null },
    })
  },
})

export const addToActiveSprint = mutation({
  args: {
    ticketId: v.id('tickets'),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const active = await activeSprintFor(ctx, teamId)
    if (!active) throw authError('NOT_FOUND', 'No active sprint found.')

    const ticket = await assertTicketInTeam(ctx, args.ticketId, teamId)
    if (ticket.type === 'epic') throw authError('FORBIDDEN', 'Epics are not sprint-scoped.')
    if (ticket.sprintId === active._id) return

    await ctx.db.patch(args.ticketId, { sprintId: active._id, updatedAt: Date.now() })
    await recomputePlannedPoints(ctx, ticket.sprintId)
    await recomputePlannedPoints(ctx, active._id)

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'ticket.moved_sprint',
      refType: 'ticket',
      refId: args.ticketId,
      ticketId: args.ticketId,
      payload: { sprintId: active._id, from: ticket.sprintId ?? null },
    })
  },
})
