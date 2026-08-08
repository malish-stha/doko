import { v } from 'convex/values'
import { mutation, query, internalQuery, MutationCtx } from './_generated/server'
import { internal } from './_generated/api'
import { appendActivityEvent } from './events'
import { requireTeam, getMembership } from './teamHelper'
import { ensureWatcher, notifyWatchers } from './watchers'
import { Id } from './_generated/dataModel'

export async function touchTicket(ctx: MutationCtx, ticketId: Id<'tickets'>) {
  try {
    await ctx.db.patch(ticketId, { updatedAt: Date.now() })
  } catch {
    // ignore
  }
}



export const getByIdInternal = internalQuery({
  args: { ticketId: v.id('tickets') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.ticketId)
  },
})

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
    sprintId: v.optional(v.union(v.id('sprints'), v.null())),
    epicId: v.optional(v.union(v.id('tickets'), v.null())),
    mode: v.optional(
      v.union(v.literal('active'), v.literal('all'), v.literal('sprint')),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)

    let results = await ctx.db
      .query('tickets')
      .withIndex('by_project_status', ix => ix.eq('projectId', args.projectId))
      .collect()

    if (teamId) {
      results = results.filter(t => !t.teamId || t.teamId === (teamId as string))
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

    if (args.mode === 'active' && teamId) {
      const active = await ctx.db
        .query('sprints')
        .withIndex('by_team_status', q =>
          q.eq('teamId', teamId).eq('status', 'active'),
        )
        .unique()
      if (active) {
        results = results.filter(t => t.sprintId === active._id)
      }
    } else if (args.sprintId !== undefined) {
      if (args.sprintId === null) {
        results = results.filter(t => !t.sprintId)
      } else {
        results = results.filter(t => t.sprintId === args.sprintId)
      }
    }

    if (args.epicId !== undefined) {
      if (args.epicId === null) {
        results = results.filter(t => !t.epicId)
      } else {
        results = results.filter(t => t.epicId === args.epicId)
      }
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

export const listEpics = query({
  args: {},
  handler: async ctx => {
    const { teamId } = await requireTeam(ctx)
    let results = await ctx.db
      .query('tickets')
      .withIndex('by_project_status', q => q.eq('projectId', 'doko'))
      .filter(f => f.eq(f.field('type'), 'epic'))
      .collect()

    if (teamId) {
      results = results.filter(t => !t.teamId || t.teamId === (teamId as string))
    }

    return results
  },
})

export const epicChildren = query({
  args: { epicId: v.id('tickets') },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    let results = await ctx.db
      .query('tickets')
      .withIndex('by_epic', q => q.eq('epicId', args.epicId))
      .collect()

    if (teamId) {
      results = results.filter(t => !t.teamId || t.teamId === (teamId as string))
    }

    return results
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
    sprintId: v.optional(v.id('sprints')),
    epicId: v.optional(v.id('tickets')),
    storyPoints: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, teamId, identity } = await requireTeam(ctx)
    const reporterId = userId


    if (args.type === 'epic') {
      if (args.sprintId) throw new Error('Epics cannot be assigned to sprints')
      if (args.epicId) throw new Error('Epics cannot have parent epics')
      if (args.storyPoints !== undefined) throw new Error('Epics roll up points from child tickets')
    }

    if (args.epicId) {
      const parentEpic = await ctx.db.get(args.epicId)
      if (!parentEpic || parentEpic.type !== 'epic') {
        throw new Error('Target parent ticket is not an epic')
      }
    }

    if (args.sprintId) {
      const sprint = await ctx.db.get(args.sprintId)
      if (!sprint || sprint.teamId !== teamId) {
        throw new Error('Sprint not found')
      }
    }

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
      sprintId: args.type === 'epic' ? undefined : args.sprintId,
      epicId: args.type === 'epic' ? undefined : args.epicId,
      storyPoints: args.type === 'epic' ? undefined : args.storyPoints,
      createdAt: now,
      updatedAt: now,
    })

    await appendActivityEvent(ctx, {
      kind: 'ticket.created',
      refType: 'ticket',
      refId: id,
      payload: { key, type: args.type, title: args.title },
    })

    await ensureWatcher(ctx, id, reporterId)
    if (args.assigneeId) {
      await ensureWatcher(ctx, id, args.assigneeId)
    }

    if (args.assigneeId) {
      await ctx.scheduler.runAfter(0, internal.email.sendAssignmentNotification, {
        ticketId: id,
        assigneeId: args.assigneeId,
        assignedByEmail: identity?.email ?? userId,
      })
    }

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
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)
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
    await notifyWatchers(ctx, args.id, userId, 'ticket.status_changed', { from, to: args.status })
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
        assignedByEmail: callerEmail,
      },
    })

    if (args.assigneeId) {
      await ensureWatcher(ctx, args.id, args.assigneeId)
      await ctx.scheduler.runAfter(0, internal.email.sendAssignmentNotification, {
        ticketId: args.id,
        assigneeId: args.assigneeId,
        assignedByEmail: callerEmail,
      })
    }

    await notifyWatchers(ctx, args.id, callerUserId, 'ticket.assigned', {
      assigneeId: args.assigneeId || null,
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
    sprintId: v.optional(v.union(v.id('sprints'), v.null())),
    epicId: v.optional(v.union(v.id('tickets'), v.null())),
    storyPoints: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const { id, userEmail, sprintId, epicId, storyPoints, ...rest } = args
    const ticket = await ctx.db.get(id)
    if (!ticket) throw new Error('Ticket not found')

    if (ticket.type === 'epic') {
      if (sprintId !== undefined && sprintId !== null) {
        throw new Error('Epics cannot be assigned to sprints')
      }
      if (epicId !== undefined && epicId !== null) {
        throw new Error('Epics cannot have parent epics')
      }
      if (storyPoints !== undefined && storyPoints !== null) {
        throw new Error('Epics roll up points from child tickets')
      }
    }

    if (epicId) {
      if (epicId === id) throw new Error('Ticket cannot be its own epic')
      const parentEpic = await ctx.db.get(epicId)
      if (!parentEpic || parentEpic.type !== 'epic') {
        throw new Error('Target parent ticket is not an epic')
      }
    }

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

    const patchObj: Record<string, any> = { ...rest, updatedAt: Date.now() }
    if (sprintId !== undefined) {
      patchObj.sprintId = sprintId === null ? undefined : sprintId
    }
    if (epicId !== undefined) {
      patchObj.epicId = epicId === null ? undefined : epicId
    }
    if (storyPoints !== undefined) {
      patchObj.storyPoints = storyPoints === null ? undefined : storyPoints
    }

    await ctx.db.patch(id, patchObj)
    await appendActivityEvent(
      ctx,
      {
        kind: 'ticket.updated',
        refType: 'ticket',
        refId: id,
        payload: patchObj,
      },
      userEmail,
    )
    const { userId } = await requireTeam(ctx, userEmail)
    await notifyWatchers(ctx, id, userId, 'ticket.updated', patchObj)

    if (rest.assigneeId && rest.assigneeId !== ticket.assigneeId) {
      const { userId, user, identity } = await requireTeam(ctx, userEmail)
      const callerEmail = (identity?.email ?? user?.email ?? userEmail)?.trim().toLowerCase()
      await ctx.scheduler.runAfter(0, internal.email.sendAssignmentNotification, {
        ticketId: id,
        assigneeId: rest.assigneeId,
        assignedByEmail: callerEmail,
      })
    }
  },
})

export const getUserTickets = query({
  args: {
    targetUserId: v.optional(v.string()),
    targetEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId: callerUserId, teamId, identity } = await requireTeam(ctx)
    const email = (args.targetEmail ?? identity?.email)?.trim().toLowerCase()
    const targetId = args.targetUserId ?? callerUserId ?? email

    if (!targetId && !email) return { ongoing: [], completed: [], total: 0 }

    let allTickets = await ctx.db.query('tickets').collect()

    if (teamId) {
      allTickets = allTickets.filter(t => !t.teamId || t.teamId === (teamId as string))
    }

    const matchesUser = (id?: string) => {
      if (!id) return false
      const clean = id.trim().toLowerCase()
      if (clean === targetId?.toLowerCase()) return true
      if (email && clean === email) return true
      return false
    }

    const userTickets = allTickets.filter(
      t => matchesUser(t.assigneeId) || matchesUser(t.reporterId),
    )

    const ongoing = userTickets
      .filter(t => t.status !== 'done')
      .sort((a, b) => b.updatedAt - a.updatedAt)

    const completed = userTickets
      .filter(t => t.status === 'done')
      .sort((a, b) => b.updatedAt - a.updatedAt)

    return {
      ongoing,
      completed,
      total: userTickets.length,
    }
  },
})

export const search = query({
  args: {
    q: v.string(),
    excludeId: v.optional(v.id('tickets')),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTeam(ctx, args.userEmail)
    const all = await ctx.db
      .query('tickets')
      .withIndex('by_project_status', q => q.eq('projectId', 'doko'))
      .collect()

    const needle = args.q.toLowerCase().trim()
    if (!needle) return all.slice(0, 10)

    return all
      .filter(
        t =>
          (t.title.toLowerCase().includes(needle) || t.key.toLowerCase().includes(needle)) &&
          t._id !== args.excludeId,
      )
      .slice(0, 20)
  },
})

export const bulkUpdateStatus = mutation({
  args: {
    ticketIds: v.array(v.id('tickets')),
    status: v.union(
      v.literal('backlog'),
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('review'),
      v.literal('done'),
    ),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTeam(ctx, args.userEmail)
    for (const id of args.ticketIds) {
      const t = await ctx.db.get(id)
      if (!t || t.status === args.status) continue
      await ctx.db.patch(id, { status: args.status, updatedAt: Date.now() })
      await appendActivityEvent(
        ctx,
        {
          kind: 'ticket.status_changed',
          refType: 'ticket',
          refId: id,
          payload: { from: t.status, to: args.status },
        },
        args.userEmail,
      )
    }
  },
})

export const bulkUpdateAssignee = mutation({
  args: {
    ticketIds: v.array(v.id('tickets')),
    assigneeId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTeam(ctx, args.userEmail)
    for (const id of args.ticketIds) {
      const t = await ctx.db.get(id)
      if (!t || t.assigneeId === args.assigneeId) continue
      await ctx.db.patch(id, { assigneeId: args.assigneeId || undefined, updatedAt: Date.now() })
      await appendActivityEvent(
        ctx,
        {
          kind: 'ticket.assigned',
          refType: 'ticket',
          refId: id,
          payload: { assigneeId: args.assigneeId || null },
        },
        args.userEmail,
      )
    }
  },
})

export const bulkUpdatePriority = mutation({
  args: {
    ticketIds: v.array(v.id('tickets')),
    priority: v.union(
      v.literal('low'),
      v.literal('medium'),
      v.literal('high'),
      v.literal('urgent'),
    ),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTeam(ctx, args.userEmail)
    for (const id of args.ticketIds) {
      const t = await ctx.db.get(id)
      if (!t || t.priority === args.priority) continue
      await ctx.db.patch(id, { priority: args.priority, updatedAt: Date.now() })
      await appendActivityEvent(
        ctx,
        {
          kind: 'ticket.updated',
          refType: 'ticket',
          refId: id,
          payload: { priority: args.priority },
        },
        args.userEmail,
      )
    }
  },
})

export const bulkDelete = mutation({
  args: {
    ticketIds: v.array(v.id('tickets')),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTeam(ctx, args.userEmail)
    for (const id of args.ticketIds) {
      const t = await ctx.db.get(id)
      if (!t) continue
      await ctx.db.delete(id)
      await appendActivityEvent(
        ctx,
        {
          kind: 'ticket.deleted',
          refType: 'ticket',
          refId: id,
          payload: { key: t.key, title: t.title },
        },
        args.userEmail,
      )
    }
  },
})



