import { v } from 'convex/values'
import { mutation, query, MutationCtx } from './_generated/server'
import { appendActivityEvent } from './events'

const TICKET_TYPE_PREFIX: Record<string, string> = {
  bug: 'BUG',
  feature: 'FEAT',
  task: 'TASK',
  epic: 'EPIC',
}

async function nextKey(ctx: MutationCtx, type: string) {
  const prefix = TICKET_TYPE_PREFIX[type]
  if (!prefix) throw new Error(`unknown ticket type: ${type}`)
  const scope = `tickets:${prefix}`
  const existing = await ctx.db
    .query('counters')
    .withIndex('by_scope', q => q.eq('scope', scope))
    .unique()
  const next = (existing?.value ?? 0) + 1
  if (existing) {
    await ctx.db.patch(existing._id, { value: next })
  } else {
    await ctx.db.insert('counters', { scope, value: next })
  }
  return `${prefix}-${next}`
}

export const list = query({
  args: {
    projectId: v.string(),
    status: v.optional(
      v.union(
        v.literal('backlog'),
        v.literal('todo'),
        v.literal('in_progress'),
        v.literal('review'),
        v.literal('done'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query('tickets')
      .withIndex('by_project_status', ix => ix.eq('projectId', args.projectId))
    if (args.status) q = q.filter(f => f.eq(f.field('status'), args.status))
    return await q.collect()
  },
})

export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tickets')
      .withIndex('by_key', q => q.eq('key', args.key))
      .unique()
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async ctx => {
    return await ctx.storage.generateUploadUrl()
  },
})

export const getAttachmentUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

export const create = mutation({
  args: {
    projectId: v.string(),
    type: v.union(
      v.literal('bug'),
      v.literal('feature'),
      v.literal('task'),
      v.literal('epic'),
    ),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(
      v.union(
        v.literal('low'),
        v.literal('medium'),
        v.literal('high'),
        v.literal('urgent'),
      ),
    ),
    attachments: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    const reporterId = identity?.email ?? identity?.subject ?? identity?.name ?? 'dev-user'
    const key = await nextKey(ctx, args.type)
    const now = Date.now()
    const id = await ctx.db.insert('tickets', {
      projectId: args.projectId,
      key,
      type: args.type,
      title: args.title,
      description: args.description,
      status: 'backlog',
      priority: args.priority ?? 'medium',
      reporterId,
      labels: [],
      attachments: args.attachments ?? [],
      createdAt: now,
      updatedAt: now,
    })
    await appendActivityEvent(ctx, {
      kind: 'ticket.created',
      refType: 'ticket',
      refId: id,
      payload: { key, type: args.type, title: args.title },
    })
    return { id, key }
  },
})

export const updateStatus = mutation({
  args: {
    id: v.id('tickets'),
    status: v.union(
      v.literal('backlog'),
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('review'),
      v.literal('done'),
    ),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.id)
    if (!ticket) throw new Error('ticket not found')
    const from = ticket.status
    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() })
    await appendActivityEvent(ctx, {
      kind: 'ticket.status_changed',
      refType: 'ticket',
      refId: args.id,
      payload: { from, to: args.status },
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('tickets'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(
      v.union(
        v.literal('low'),
        v.literal('medium'),
        v.literal('high'),
        v.literal('urgent'),
      ),
    ),
    assigneeId: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    attachments: v.optional(v.array(v.string())),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args
    await ctx.db.patch(id, { ...rest, updatedAt: Date.now() })
    await appendActivityEvent(ctx, {
      kind: 'ticket.updated',
      refType: 'ticket',
      refId: id,
      payload: rest,
    })
  },
})
