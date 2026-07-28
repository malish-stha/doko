import { v } from 'convex/values'
import { mutation, query, MutationCtx } from './_generated/server'
import { appendActivityEvent } from './events'
import { requireTeam, getMembership } from './teamHelper'

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
    q: v.optional(v.string()),
    mine: v.optional(v.boolean()),
    hipri: v.optional(v.boolean()),
    dueThisWeek: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)

    let results = await ctx.db
      .query('tickets')
      .withIndex('by_project_status', ix => ix.eq('projectId', args.projectId))
      .collect()

    if (teamId) {
      results = results.filter(t => t.teamId === (teamId as string))
    }

    if (args.status) {
      results = results.filter(t => t.status === args.status)
    }

    if (args.q) {
      const needle = args.q.toLowerCase()
      results = results.filter(t => t.title.toLowerCase().includes(needle))
    }

    if (args.mine) {
      results = results.filter(
        t => userId && (t.reporterId === userId || t.assigneeId === userId),
      )
    }

    if (args.hipri) {
      results = results.filter(
        t => t.priority === 'high' || t.priority === 'urgent',
      )
    }

    if (args.dueThisWeek) {
      const oneWeek = Date.now() + 7 * 24 * 60 * 60 * 1000
      results = results.filter(
        t => t.dueDate !== undefined && t.dueDate < oneWeek,
      )
    }

    return results
  },
})

export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    const ticket = await ctx.db
      .query('tickets')
      .withIndex('by_key', q => q.eq('key', args.key))
      .unique()

    if (ticket && teamId && ticket.teamId && ticket.teamId !== (teamId as string)) {
      return null
    }
    return ticket
  },
})

export const listAssignableMembers = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) return []
    const members = await ctx.db
      .query('teamMembers')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .collect()
    const allUsers = await ctx.db.query('users').collect()
    const userMap = new Map(allUsers.map(u => [u.userId, u]))
    const emailMap = new Map(allUsers.map(u => [u.email.toLowerCase(), u]))

    return members.map(m => {
      const u = userMap.get(m.userId) ?? emailMap.get(m.email.toLowerCase())
      return {
        userId: m.userId,
        email: m.email,
        name: u?.name || m.email.split('@')[0],
        role: m.role,
      }
    })
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

export const getAttachmentMetadata = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId)
    const meta = await ctx.storage.getMetadata(args.storageId as any)
    return {
      url,
      contentType: meta?.contentType ?? null,
      size: meta?.size ?? null,
    }
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
    assigneeId: v.optional(v.string()),
    attachments: v.optional(v.array(v.string())),
    sourceMessageId: v.optional(v.id('messages')),
  },
  handler: async (ctx, args) => {
    const { userId, teamId, identity } = await requireTeam(ctx)
    const reporterId = identity?.email ?? userId
    const key = await nextKey(ctx, args.type)
    const now = Date.now()
    const id = await ctx.db.insert('tickets', {
      teamId: teamId as string | undefined,
      projectId: args.projectId,
      key,
      type: args.type,
      title: args.title,
      description: args.description,
      status: 'backlog',
      priority: args.priority ?? 'medium',
      assigneeId: args.assigneeId,
      reporterId,
      labels: [],
      attachments: args.attachments ?? [],
      sourceMessageId: args.sourceMessageId,
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

export const assign = mutation({
  args: {
    id: v.id('tickets'),
    assigneeId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user, teamId, identity } = await requireTeam(ctx, args.userEmail)
    const ticket = await ctx.db.get(args.id)
    if (!ticket) throw new Error('Ticket not found')

    const callerUserId = user?.userId ?? userId
    const callerEmail = (identity?.email ?? user?.email ?? args.userEmail)?.trim().toLowerCase()

    if (teamId && ticket.teamId && ticket.teamId !== (teamId as string)) {
      throw new Error('Unauthorized team access')
    }

    const me = teamId && callerUserId ? await getMembership(ctx, teamId, callerUserId, callerEmail) : null
    const isAdmin = me?.role === 'owner' || me?.role === 'admin'

    const isCreator =
      ticket.reporterId === callerUserId ||
      (callerEmail && ticket.reporterId.trim().toLowerCase() === callerEmail) ||
      (user && ticket.reporterId === user.userId)

    const isSelfAssign =
      args.assigneeId !== undefined &&
      (args.assigneeId === callerUserId ||
        (callerEmail && args.assigneeId.trim().toLowerCase() === callerEmail) ||
        (user && args.assigneeId === user.userId))

    if (!isCreator && !isAdmin && !isSelfAssign) {
      throw new Error(
        'Unauthorized: Only the ticket creator or team admins can assign tickets to other users. You can assign tickets to yourself.',
      )
    }

    await ctx.db.patch(args.id, {
      assigneeId: args.assigneeId || undefined,
      updatedAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      kind: 'ticket.assigned',
      refType: 'ticket',
      refId: args.id,
      payload: {
        assigneeId: args.assigneeId || null,
        assignedBy: callerUserId,
      },
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
    userEmail: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    attachments: v.optional(v.array(v.string())),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, userEmail, ...rest } = args
    const ticket = await ctx.db.get(id)
    if (!ticket) throw new Error('Ticket not found')

    if (rest.assigneeId !== undefined && rest.assigneeId !== ticket.assigneeId) {
      const { userId, user, teamId, identity } = await requireTeam(ctx, userEmail)
      const callerUserId = user?.userId ?? userId
      const callerEmail = (identity?.email ?? user?.email ?? userEmail)?.trim().toLowerCase()
      const me = teamId && callerUserId ? await getMembership(ctx, teamId, callerUserId, callerEmail) : null
      const isAdmin = me?.role === 'owner' || me?.role === 'admin'
      const isCreator =
        ticket.reporterId === callerUserId ||
        (callerEmail && ticket.reporterId.trim().toLowerCase() === callerEmail) ||
        (user && ticket.reporterId === user.userId)
      const isSelfAssign =
        rest.assigneeId === callerUserId ||
        (callerEmail && rest.assigneeId.trim().toLowerCase() === callerEmail) ||
        (user && rest.assigneeId === user.userId)

      if (!isCreator && !isAdmin && !isSelfAssign) {
        throw new Error(
          'Unauthorized: Only the ticket creator or team admins can assign tickets to other users. You can assign tickets to yourself.',
        )
      }
    }

    await ctx.db.patch(id, { ...rest, updatedAt: Date.now() })
    await appendActivityEvent(ctx, {
      kind: 'ticket.updated',
      refType: 'ticket',
      refId: id,
      payload: rest,
    })
  },
})

