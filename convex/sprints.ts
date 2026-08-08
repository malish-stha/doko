import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTeam } from './teamHelper'
import { appendActivityEvent } from './events'
import type { Id } from './_generated/dataModel'

export const listForTeam = query({
  args: {
    status: v.optional(
      v.union(v.literal('planning'), v.literal('active'), v.literal('completed')),
    ),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) return []
    if (args.status) {
      return await ctx.db
        .query('sprints')
        .withIndex('by_team_status', q =>
          q.eq('teamId', teamId).eq('status', args.status!),
        )
        .collect()
    }
    return await ctx.db
      .query('sprints')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .order('desc')
      .collect()
  },
})

export const activeSprint = query({
  args: {
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) return null
    return await ctx.db
      .query('sprints')
      .withIndex('by_team_status', q =>
        q.eq('teamId', teamId).eq('status', 'active'),
      )
      .unique()
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    goal: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) throw new Error('Unauthorized: Team required')

    const id = await ctx.db.insert('sprints', {
      teamId,
      name: args.name.trim(),
      goal: args.goal?.trim() || undefined,
      status: 'planning',
      createdAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      kind: 'sprint.created',
      refType: 'sprint',
      refId: id,
      payload: { name: args.name },
    })

    return id
  },
})

export const start = mutation({
  args: {
    sprintId: v.id('sprints'),
    durationDays: v.optional(v.number()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx, args.userEmail)
    const sprint = await ctx.db.get(args.sprintId)
    if (!sprint || sprint.teamId !== teamId) throw new Error('Sprint not found')
    if (sprint.status !== 'planning') {
      throw new Error('Sprint is not in planning state')
    }

    // Enforce single active sprint per team
    const otherActive = await ctx.db
      .query('sprints')
      .withIndex('by_team_status', q =>
        q.eq('teamId', teamId).eq('status', 'active'),
      )
      .unique()

    if (otherActive) {
      throw new Error(`Another sprint is active: ${otherActive.name}`)
    }

    const ticketsInSprint = await ctx.db
      .query('tickets')
      .withIndex('by_sprint', q => q.eq('sprintId', args.sprintId))
      .collect()

    const plannedPoints = ticketsInSprint.reduce(
      (sum, t) => sum + (t.storyPoints ?? 0),
      0,
    )

    const days = args.durationDays ?? 14
    const now = Date.now()
    const endDate = now + days * 24 * 60 * 60 * 1000

    await ctx.db.patch(args.sprintId, {
      status: 'active',
      startDate: now,
      endDate,
      plannedPoints,
    })

    await appendActivityEvent(ctx, {
      kind: 'sprint.started',
      refType: 'sprint',
      refId: args.sprintId,
      payload: { durationDays: days, plannedPoints },
    })
  },
})

export const complete = mutation({
  args: {
    sprintId: v.id('sprints'),
    rollover: v.optional(
      v.union(v.literal('backlog'), v.id('sprints')),
    ),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx, args.userEmail)
    const sprint = await ctx.db.get(args.sprintId)
    if (!sprint || sprint.teamId !== teamId) throw new Error('Sprint not found')
    if (sprint.status !== 'active') throw new Error('Sprint is not active')

    const incomplete = await ctx.db
      .query('tickets')
      .withIndex('by_sprint', q => q.eq('sprintId', args.sprintId))
      .filter(f => f.neq(f.field('status'), 'done'))
      .collect()

    const rolloverTarget = args.rollover ?? 'backlog'

    for (const t of incomplete) {
      const newSprintId =
        rolloverTarget === 'backlog'
          ? undefined
          : (rolloverTarget as Id<'sprints'>)
      await ctx.db.patch(t._id, {
        sprintId: newSprintId,
        updatedAt: Date.now(),
      })
    }

    await ctx.db.patch(args.sprintId, {
      status: 'completed',
      endDate: Date.now(),
    })

    await appendActivityEvent(ctx, {
      kind: 'sprint.completed',
      refType: 'sprint',
      refId: args.sprintId,
      payload: {
        rolledOver: incomplete.length,
        rollover: rolloverTarget,
      },
    })
  },
})

export const moveTicket = mutation({
  args: {
    ticketId: v.id('tickets'),
    sprintId: v.union(v.id('sprints'), v.null()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx, args.userEmail)
    const ticket = await ctx.db.get(args.ticketId)
    if (!ticket) throw new Error('Ticket not found')
    if (ticket.type === 'epic') {
      throw new Error('Epics are not sprint-scoped')
    }

    if (args.sprintId) {
      const sprint = await ctx.db.get(args.sprintId)
      if (!sprint || sprint.teamId !== teamId) {
        throw new Error('Sprint not found')
      }
    }

    await ctx.db.patch(args.ticketId, {
      sprintId: args.sprintId ?? undefined,
      updatedAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      kind: 'ticket.moved_sprint',
      refType: 'ticket',
      refId: args.ticketId,
      payload: { sprintId: args.sprintId },
    })
  },
})

export const addToActiveSprint = mutation({
  args: {
    ticketId: v.id('tickets'),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) throw new Error('Unauthorized: Team required')

    const active = await ctx.db
      .query('sprints')
      .withIndex('by_team_status', q =>
        q.eq('teamId', teamId).eq('status', 'active'),
      )
      .unique()

    if (!active) {
      throw new Error('No active sprint found')
    }

    const ticket = await ctx.db.get(args.ticketId)
    if (!ticket) throw new Error('Ticket not found')
    if (ticket.type === 'epic') {
      throw new Error('Epics are not sprint-scoped')
    }

    await ctx.db.patch(args.ticketId, {
      sprintId: active._id,
      updatedAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      kind: 'ticket.moved_sprint',
      refType: 'ticket',
      refId: args.ticketId,
      payload: { sprintId: active._id },
    })
  },
})
