import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTeam } from './teamHelper'
import { appendActivityEvent } from './events'
import { notifyWatchers } from './watchers'
import { touchTicket } from './tickets'


export const byTicket = query({
  args: { ticketId: v.id('tickets'), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireTeam(ctx, args.userEmail)
    const rows = await ctx.db
      .query('subtasks')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .collect()
    return rows.sort((a, b) => a.order - b.order)
  },
})

export const add = mutation({
  args: {
    ticketId: v.id('tickets'),
    title: v.string(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)
    const title = args.title.trim()
    if (!title) throw new Error('empty title')

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

    await appendActivityEvent(
      ctx,
      {
        kind: 'subtask.added',
        refType: 'subtask',
        refId: id,
        payload: { ticketId: args.ticketId, title },
      },
      args.userEmail,
    )

    await notifyWatchers(ctx, args.ticketId, userId, 'subtask.added', { title })
    await touchTicket(ctx, args.ticketId)

    return id
  },
})

export const toggle = mutation({
  args: {
    subtaskId: v.id('subtasks'),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)
    const st = await ctx.db.get(args.subtaskId)
    if (!st) throw new Error('subtask not found')

    const nextDone = !st.done
    await ctx.db.patch(args.subtaskId, { done: nextDone })

    const kind = nextDone ? 'subtask.checked' : 'subtask.unchecked'
    await appendActivityEvent(
      ctx,
      {
        kind,
        refType: 'subtask',
        refId: args.subtaskId,
        payload: { ticketId: st.ticketId, title: st.title },
      },
      args.userEmail,
    )

    await notifyWatchers(ctx, st.ticketId, userId, kind, { title: st.title })
    await touchTicket(ctx, st.ticketId)
  },
})


export const rename = mutation({
  args: {
    subtaskId: v.id('subtasks'),
    title: v.string(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTeam(ctx, args.userEmail)
    const title = args.title.trim()
    if (!title) throw new Error('empty title')

    const st = await ctx.db.get(args.subtaskId)
    if (!st) throw new Error('subtask not found')

    await ctx.db.patch(args.subtaskId, { title })
    await touchTicket(ctx, st.ticketId)
  },
})

export const remove = mutation({
  args: {
    subtaskId: v.id('subtasks'),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)
    const st = await ctx.db.get(args.subtaskId)
    if (!st) throw new Error('subtask not found')

    await ctx.db.delete(args.subtaskId)

    await appendActivityEvent(
      ctx,
      {
        kind: 'subtask.removed',
        refType: 'subtask',
        refId: args.subtaskId,
        payload: { ticketId: st.ticketId, title: st.title },
      },
      args.userEmail,
    )


    await notifyWatchers(ctx, st.ticketId, userId, 'subtask.removed', { title: st.title })
    await touchTicket(ctx, st.ticketId)
  },
})


export const reorder = mutation({
  args: {
    subtaskId: v.id('subtasks'),
    newOrder: v.number(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTeam(ctx, args.userEmail)
    const st = await ctx.db.get(args.subtaskId)
    if (!st) throw new Error('subtask not found')

    await ctx.db.patch(args.subtaskId, { order: args.newOrder })
  },
})
