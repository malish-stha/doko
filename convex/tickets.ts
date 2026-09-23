import { v } from 'convex/values'
import { mutation, query, internalQuery, MutationCtx } from './_generated/server'
import { internal } from './_generated/api'
import { appendActivityEvent } from './events'
import {
  Ctx,
  TeamContext,
  assertTicketInTeam,
  authError,
  getMembership,
  isAdminRole,
  normalizeEmail,
  requireTeam,
} from './teamHelper'
import { ensureWatcher, notifyWatchers } from './watchers'
import { Doc, Id } from './_generated/dataModel'
import { extractMentionIds } from '../lib/mentions'
import { activeSprintFor, recomputePlannedPoints } from './sprintHelper'
import { assertWithinWipLimit, boardConfigFor } from './boardConfig'

const TICKET_STATUS = v.union(
  v.literal('backlog'),
  v.literal('todo'),
  v.literal('in_progress'),
  v.literal('review'),
  v.literal('done'),
)
const TICKET_PRIORITY = v.union(
  v.literal('low'),
  v.literal('medium'),
  v.literal('high'),
  v.literal('urgent'),
)
const TICKET_TYPE = v.union(
  v.literal('bug'),
  v.literal('feature'),
  v.literal('task'),
  v.literal('epic'),
)

/** Bumps updatedAt. Throws NOT_FOUND for a missing ticket instead of hiding it. */
export async function touchTicket(ctx: MutationCtx, ticketId: Id<'tickets'>) {
  const ticket = await ctx.db.get(ticketId)
  if (!ticket) throw authError('NOT_FOUND', 'Ticket not found.')
  await ctx.db.patch(ticketId, { updatedAt: Date.now() })
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

/** Per-team, per-type counter so two teams never collide on BUG-1. */
async function nextKey(ctx: MutationCtx, teamId: Id<'teams'>, type: string) {
  const prefix = TICKET_TYPE_PREFIX[type]
  if (!prefix) throw new Error(`unknown ticket type: ${type}`)
  const scope = `tickets:${teamId}:${prefix}`
  const existing = await ctx.db
    .query('counters')
    .withIndex('by_scope', q => q.eq('scope', scope))
    .first()
  const next = (existing?.value ?? 0) + 1
  if (existing) {
    await ctx.db.patch(existing._id, { value: next })
  } else {
    await ctx.db.insert('counters', { scope, value: next })
  }
  return `${prefix}-${next}`
}

/**
 * Resolves an assignee to a canonical membership userId. Accepts the
 * member's userId or email; rejects anything that is not on the team.
 */
async function resolveAssignee(ctx: Ctx, teamId: Id<'teams'>, raw: string) {
  const member = await getMembership(ctx, teamId, raw.trim(), normalizeEmail(raw))
  if (!member) {
    throw authError('NOT_A_MEMBER', 'Assignee must be a member of this team.')
  }
  return member.userId
}

/** Creator, team admin, or self-assignment may set an assignee. */
function assertCanAssign(ticket: Doc<'tickets'>, caller: TeamContext, assigneeUserId: string | undefined) {
  const isCreator = ticket.reporterId === caller.userId || normalizeEmail(ticket.reporterId) === caller.email
  const isSelfAssign = assigneeUserId !== undefined && assigneeUserId === caller.userId
  if (!isCreator && !isAdminRole(caller.role) && !isSelfAssign) {
    throw authError(
      'FORBIDDEN',
      'Only the ticket creator or team admins can assign tickets to other users. You can assign tickets to yourself.',
    )
  }
}

/** Reporter or team admin may delete. */
function assertCanDelete(ticket: Doc<'tickets'>, caller: TeamContext) {
  const isCreator = ticket.reporterId === caller.userId || normalizeEmail(ticket.reporterId) === caller.email
  if (!isCreator && !isAdminRole(caller.role)) {
    throw authError('FORBIDDEN', 'Only the ticket creator or team admins can delete tickets.')
  }
}

async function assertEpicInTeam(ctx: Ctx, epicId: Id<'tickets'>, teamId: Id<'teams'>) {
  const parentEpic = await ctx.db.get(epicId)
  if (!parentEpic || parentEpic.teamId !== (teamId as string) || parentEpic.type !== 'epic') {
    throw authError('NOT_FOUND', 'Target parent ticket is not an epic in this team.')
  }
  return parentEpic
}

async function assertSprintInTeam(ctx: Ctx, sprintId: Id<'sprints'>, teamId: Id<'teams'>) {
  const sprint = await ctx.db.get(sprintId)
  if (!sprint || sprint.teamId !== teamId) throw authError('NOT_FOUND', 'Sprint not found.')
  return sprint
}

/** BOARD-03: refuse to move `incoming` tickets into a column that is at its WIP limit. */
async function assertWipCapacity(ctx: Ctx, teamId: Id<'teams'>, status: Doc<'tickets'>['status'], incoming: number) {
  if (incoming <= 0) return
  const config = await boardConfigFor(ctx, teamId)
  if (!config?.wipLimits?.[status]) return
  const inColumn = await ctx.db
    .query('tickets')
    .withIndex('by_team_status', q => q.eq('teamId', teamId as string).eq('status', status))
    .collect()
  assertWithinWipLimit(config, status, inColumn.length + incoming - 1)
}

/** Mentions in a description notify teammates (never the author). */
async function notifyDescriptionMentions(
  ctx: MutationCtx,
  teamId: Id<'teams'>,
  ticketId: Id<'tickets'>,
  authorId: string,
  description: string | undefined,
) {
  if (!description) return
  const now = Date.now()
  for (const mentioned of extractMentionIds(description)) {
    const member = await getMembership(ctx, teamId, mentioned, normalizeEmail(mentioned))
    if (!member || member.userId === authorId) continue
    await ctx.db.insert('mentions', {
      contextRefType: 'ticket',
      contextRefId: ticketId,
      mentionedUserId: member.userId,
      mentionedByUserId: authorId,
      read: false,
      createdAt: now,
    })
  }
}

/** Deletes a ticket and everything attached to it, including storage blobs. */
export async function deleteTicketCascade(ctx: MutationCtx, ticket: Doc<'tickets'>) {
  const id = ticket._id
  const comments = await ctx.db.query('comments').withIndex('by_ticket', q => q.eq('ticketId', id)).collect()
  for (const c of comments) {
    const commentMentions = await ctx.db
      .query('mentions')
      .withIndex('by_context', q => q.eq('contextRefType', 'comment').eq('contextRefId', c._id))
      .collect()
    for (const m of commentMentions) await ctx.db.delete(m._id)
    await ctx.db.delete(c._id)
  }
  const subtasks = await ctx.db.query('subtasks').withIndex('by_ticket', q => q.eq('ticketId', id)).collect()
  for (const s of subtasks) await ctx.db.delete(s._id)
  const watchers = await ctx.db.query('watchers').withIndex('by_ticket', q => q.eq('ticketId', id)).collect()
  for (const w of watchers) await ctx.db.delete(w._id)
  const mentions = await ctx.db
    .query('mentions')
    .withIndex('by_context', q => q.eq('contextRefType', 'ticket').eq('contextRefId', id))
    .collect()
  for (const m of mentions) await ctx.db.delete(m._id)
  const outgoing = await ctx.db.query('ticketLinks').withIndex('by_source', q => q.eq('sourceId', id)).collect()
  const incoming = await ctx.db.query('ticketLinks').withIndex('by_target', q => q.eq('targetId', id)).collect()
  for (const l of [...outgoing, ...incoming]) await ctx.db.delete(l._id)
  const attachments = await ctx.db.query('attachments').withIndex('by_ticket', q => q.eq('ticketId', id)).collect()
  const blobIds = new Set<string>(attachments.map(a => a.storageId as string))
  for (const legacy of ticket.attachments ?? []) blobIds.add(legacy)
  for (const a of attachments) await ctx.db.delete(a._id)
  for (const blob of blobIds) {
    try {
      await ctx.storage.delete(blob as Id<'_storage'>)
    } catch {
      // already gone
    }
  }
  await ctx.db.delete(id)
}

export const list = query({
  args: {
    projectId: v.string(),
    status: v.optional(TICKET_STATUS),
    q: v.optional(v.string()),
    mine: v.optional(v.boolean()),
    hipri: v.optional(v.boolean()),
    dueThisWeek: v.optional(v.boolean()),
    sprintId: v.optional(v.union(v.id('sprints'), v.null())),
    epicId: v.optional(v.union(v.id('tickets'), v.null())),
    mode: v.optional(v.union(v.literal('active'), v.literal('all'), v.literal('sprint'), v.literal('scheduled'))),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)

    let results = args.status
      ? await ctx.db
          .query('tickets')
          .withIndex('by_team_status', ix => ix.eq('teamId', teamId as string).eq('status', args.status!))
          .collect()
      : await ctx.db
          .query('tickets')
          .withIndex('by_team_status', ix => ix.eq('teamId', teamId as string))
          .collect()

    results = results.filter(t => t.projectId === args.projectId)

    if (args.q) {
      const needle = args.q.toLowerCase()
      results = results.filter(t => t.title.toLowerCase().includes(needle))
    }

    if (args.mine) {
      results = results.filter(t => t.reporterId === userId || t.assigneeId === userId)
    }

    if (args.hipri) {
      results = results.filter(t => t.priority === 'high' || t.priority === 'urgent')
    }

    if (args.dueThisWeek) {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const lower = startOfToday.getTime()
      const upper = Date.now() + 7 * 24 * 60 * 60 * 1000
      results = results.filter(t => t.dueDate !== undefined && t.dueDate >= lower && t.dueDate < upper)
    }

    if (args.mode === 'active') {
      const active = await activeSprintFor(ctx, teamId)
      results = active ? results.filter(t => t.sprintId === active._id) : []
    } else if (args.mode === 'scheduled') {
      results = results.filter(t => Boolean(t.sprintId))
    } else if (args.sprintId !== undefined) {
      results = args.sprintId === null
        ? results.filter(t => !t.sprintId)
        : results.filter(t => t.sprintId === args.sprintId)
    }

    if (args.epicId !== undefined) {
      results = args.epicId === null
        ? results.filter(t => !t.epicId)
        : results.filter(t => t.epicId === args.epicId)
    }

    return results
  },
})

export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    const matches = await ctx.db
      .query('tickets')
      .withIndex('by_key', q => q.eq('key', args.key))
      .collect()
    // Keys are unique per team, not globally (see nextKey).
    return matches.find(t => t.teamId === (teamId as string)) ?? null
  },
})

export const getById = query({
  args: { id: v.id('tickets') },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    const ticket = await ctx.db.get(args.id)
    if (!ticket || ticket.teamId !== (teamId as string)) return null
    return ticket
  },
})

export const listAssignableMembers = query({
  args: {},
  handler: async ctx => {
    const { teamId } = await requireTeam(ctx)
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
    await requireTeam(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

/** Resolves a storage id to an attachment row the caller's team owns. */
async function attachmentForStorage(ctx: Ctx, storageId: string, teamId: Id<'teams'>) {
  // Storage ids cannot be normalised via db.normalizeId; the index lookup validates them.
  const normalized = storageId as Id<'_storage'>
  const row = await ctx.db
    .query('attachments')
    .withIndex('by_storage', q => q.eq('storageId', normalized))
    .first()
  if (!row) return null
  const ticket = await ctx.db.get(row.ticketId)
  if (!ticket || ticket.teamId !== (teamId as string)) return null
  return { row, storageId: normalized }
}

export const getAttachmentUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    const found = await attachmentForStorage(ctx, args.storageId, teamId)
    if (!found) return null
    return await ctx.storage.getUrl(found.storageId)
  },
})

export const getAttachmentMetadata = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    const found = await attachmentForStorage(ctx, args.storageId, teamId)
    if (!found) return null
    const url = await ctx.storage.getUrl(found.storageId)
    return {
      url,
      contentType: found.row.mimeType,
      size: found.row.size,
      filename: found.row.filename,
    }
  },
})

export const listEpics = query({
  args: { projectId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    const rows = await ctx.db
      .query('tickets')
      .withIndex('by_team_status', q => q.eq('teamId', teamId as string))
      .collect()
    return rows.filter(
      t => t.type === 'epic' && (args.projectId === undefined || t.projectId === args.projectId),
    )
  },
})

export const epicChildren = query({
  args: { epicId: v.id('tickets') },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    const epic = await ctx.db.get(args.epicId)
    if (!epic || epic.teamId !== (teamId as string)) return []
    const rows = await ctx.db
      .query('tickets')
      .withIndex('by_epic', q => q.eq('epicId', args.epicId))
      .collect()
    return rows.filter(t => t.teamId === (teamId as string))
  },
})

export const create = mutation({
  args: {
    projectId: v.string(),
    type: TICKET_TYPE,
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(TICKET_PRIORITY),
    assigneeId: v.optional(v.string()),
    attachments: v.optional(v.array(v.string())),
    sourceMessageId: v.optional(v.id('messages')),
    sprintId: v.optional(v.id('sprints')),
    epicId: v.optional(v.id('tickets')),
    storyPoints: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const caller = await requireTeam(ctx)
    const { userId, teamId } = caller
    const title = args.title.trim()
    if (!title) throw authError('FORBIDDEN', 'Title is required.')

    if (args.type === 'epic') {
      if (args.sprintId) throw new Error('Epics cannot be assigned to sprints')
      if (args.epicId) throw new Error('Epics cannot have parent epics')
      if (args.storyPoints !== undefined) throw new Error('Epics roll up points from child tickets')
    }

    if (args.epicId) await assertEpicInTeam(ctx, args.epicId, teamId)
    if (args.sprintId) await assertSprintInTeam(ctx, args.sprintId, teamId)

    const assigneeId = args.assigneeId ? await resolveAssignee(ctx, teamId, args.assigneeId) : undefined

    const key = await nextKey(ctx, teamId, args.type)
    const now = Date.now()
    const id = await ctx.db.insert('tickets', {
      teamId: teamId as string,
      projectId: args.projectId,
      key,
      type: args.type,
      title,
      description: args.description,
      status: 'backlog',
      priority: args.priority ?? 'medium',
      assigneeId,
      reporterId: userId,
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
      teamId,
      userId,
      kind: 'ticket.created',
      refType: 'ticket',
      refId: id,
      ticketId: id,
      payload: { key, type: args.type, title },
    })

    await ensureWatcher(ctx, id, userId)
    if (assigneeId) {
      await ensureWatcher(ctx, id, assigneeId)
      await ctx.scheduler.runAfter(0, internal.email.sendAssignmentNotification, {
        ticketId: id,
        assigneeId,
        assignedByUserId: userId,
      })
    }

    await notifyDescriptionMentions(ctx, teamId, id, userId, args.description)

    return { id, key }
  },
})

export const updateStatus = mutation({
  args: {
    id: v.id('tickets'),
    status: TICKET_STATUS,
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const ticket = await assertTicketInTeam(ctx, args.id, teamId)
    if (ticket.status === args.status) return
    const from = ticket.status
    await assertWipCapacity(ctx, teamId, args.status, 1)
    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() })
    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'ticket.status_changed',
      refType: 'ticket',
      refId: args.id,
      ticketId: args.id,
      payload: { from, to: args.status },
    })
    await notifyWatchers(ctx, args.id, userId, 'ticket.status_changed', { from, to: args.status })
  },
})

export const assign = mutation({
  args: {
    id: v.id('tickets'),
    assigneeId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const caller = await requireTeam(ctx)
    const { userId, teamId, email } = caller
    const ticket = await assertTicketInTeam(ctx, args.id, teamId)

    const assigneeId = args.assigneeId ? await resolveAssignee(ctx, teamId, args.assigneeId) : undefined
    assertCanAssign(ticket, caller, assigneeId)
    if ((ticket.assigneeId ?? undefined) === assigneeId) return

    await ctx.db.patch(args.id, { assigneeId, updatedAt: Date.now() })

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'ticket.assigned',
      refType: 'ticket',
      refId: args.id,
      ticketId: args.id,
      payload: { assigneeId: assigneeId ?? null, assignedByEmail: email },
    })

    if (assigneeId) {
      await ensureWatcher(ctx, args.id, assigneeId)
      await ctx.scheduler.runAfter(0, internal.email.sendAssignmentNotification, {
        ticketId: args.id,
        assigneeId,
        assignedByUserId: userId,
      })
    }

    await notifyWatchers(ctx, args.id, userId, 'ticket.assigned', { assigneeId: assigneeId ?? null })
  },
})

type UpdatePatch = Partial<
  Pick<
    Doc<'tickets'>,
    | 'title'
    | 'description'
    | 'priority'
    | 'assigneeId'
    | 'labels'
    | 'attachments'
    | 'dueDate'
    | 'sprintId'
    | 'epicId'
    | 'storyPoints'
  >
>

export const update = mutation({
  args: {
    id: v.id('tickets'),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    priority: v.optional(TICKET_PRIORITY),
    assigneeId: v.optional(v.union(v.string(), v.null())),
    labels: v.optional(v.array(v.string())),
    attachments: v.optional(v.array(v.string())),
    dueDate: v.optional(v.union(v.number(), v.null())),
    sprintId: v.optional(v.union(v.id('sprints'), v.null())),
    epicId: v.optional(v.union(v.id('tickets'), v.null())),
    storyPoints: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const caller = await requireTeam(ctx)
    const { userId, teamId } = caller
    const ticket = await assertTicketInTeam(ctx, args.id, teamId)

    if (ticket.type === 'epic') {
      if (args.sprintId) throw new Error('Epics cannot be assigned to sprints')
      if (args.epicId) throw new Error('Epics cannot have parent epics')
      if (args.storyPoints) throw new Error('Epics roll up points from child tickets')
    }

    const patch: UpdatePatch = {}
    // `null` clears an optional field; `undefined` leaves it untouched.
    const clear = <K extends keyof UpdatePatch>(key: K, value: UpdatePatch[K] | null | undefined) => {
      if (value === undefined) return
      const next = value === null ? undefined : value
      if (ticket[key] !== next) patch[key] = next as UpdatePatch[K]
    }

    if (args.title !== undefined) {
      const title = args.title.trim()
      if (!title) throw authError('FORBIDDEN', 'Title cannot be empty.')
      if (title !== ticket.title) patch.title = title
    }
    clear('description', args.description)
    clear('priority', args.priority)
    clear('dueDate', args.dueDate)
    clear('storyPoints', args.storyPoints)
    if (args.labels !== undefined && JSON.stringify(args.labels) !== JSON.stringify(ticket.labels)) {
      patch.labels = args.labels
    }
    if (
      args.attachments !== undefined &&
      JSON.stringify(args.attachments) !== JSON.stringify(ticket.attachments ?? [])
    ) {
      patch.attachments = args.attachments
    }

    if (args.epicId) {
      if (args.epicId === args.id) throw new Error('Ticket cannot be its own epic')
      await assertEpicInTeam(ctx, args.epicId, teamId)
    }
    clear('epicId', args.epicId)

    if (args.sprintId) await assertSprintInTeam(ctx, args.sprintId, teamId)
    clear('sprintId', args.sprintId)

    let newAssignee: string | undefined | null = null // null = unchanged
    if (args.assigneeId !== undefined) {
      const resolved = args.assigneeId ? await resolveAssignee(ctx, teamId, args.assigneeId) : undefined
      if ((ticket.assigneeId ?? undefined) !== resolved) {
        assertCanAssign(ticket, caller, resolved)
        patch.assigneeId = resolved
        newAssignee = resolved
      }
    }

    if (Object.keys(patch).length === 0) return

    await ctx.db.patch(args.id, { ...patch, updatedAt: Date.now() })

    // Event payload records every field that actually changed; explicit null = cleared.
    const changed: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(patch)) changed[k] = val === undefined ? null : val

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'ticket.updated',
      refType: 'ticket',
      refId: args.id,
      ticketId: args.id,
      payload: changed,
    })
    await notifyWatchers(ctx, args.id, userId, 'ticket.updated', changed)

    if ('description' in patch) {
      await notifyDescriptionMentions(ctx, teamId, args.id, userId, patch.description)
    }

    if ('sprintId' in patch || 'storyPoints' in patch) {
      await recomputePlannedPoints(ctx, ticket.sprintId)
      await recomputePlannedPoints(ctx, patch.sprintId)
    }

    if (newAssignee) {
      await ensureWatcher(ctx, args.id, newAssignee)
      await ctx.scheduler.runAfter(0, internal.email.sendAssignmentNotification, {
        ticketId: args.id,
        assigneeId: newAssignee,
        assignedByUserId: userId,
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
    const { userId: callerUserId, teamId, email: callerEmail } = await requireTeam(ctx)
    const email = normalizeEmail(args.targetEmail ?? callerEmail)
    const targetId = (args.targetUserId ?? callerUserId).trim().toLowerCase()

    const teamTickets = await ctx.db
      .query('tickets')
      .withIndex('by_team_status', q => q.eq('teamId', teamId as string))
      .collect()

    const matchesUser = (id?: string) => {
      if (!id) return false
      const clean = id.trim().toLowerCase()
      return clean === targetId || clean === email
    }

    const userTickets = teamTickets.filter(t => matchesUser(t.assigneeId) || matchesUser(t.reporterId))

    const ongoing = userTickets.filter(t => t.status !== 'done').sort((a, b) => b.updatedAt - a.updatedAt)
    const completed = userTickets.filter(t => t.status === 'done').sort((a, b) => b.updatedAt - a.updatedAt)

    return { ongoing, completed, total: userTickets.length }
  },
})

export const search = query({
  args: {
    q: v.string(),
    excludeId: v.optional(v.id('tickets')),
  },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    const needle = args.q.toLowerCase().trim()
    if (!needle) return []

    const all = await ctx.db
      .query('tickets')
      .withIndex('by_team_status', q => q.eq('teamId', teamId as string))
      .collect()

    return all
      .filter(
        t =>
          t._id !== args.excludeId &&
          (t.title.toLowerCase().includes(needle) || t.key.toLowerCase().includes(needle)),
      )
      .slice(0, 20)
  },
})

/** Loads every id, asserting each belongs to the caller's team. */
async function loadTeamTickets(ctx: Ctx, ids: Id<'tickets'>[], teamId: Id<'teams'>) {
  const unique = Array.from(new Set(ids))
  if (unique.length > 200) throw authError('FORBIDDEN', 'Bulk actions are limited to 200 tickets.')
  const tickets: Doc<'tickets'>[] = []
  for (const id of unique) tickets.push(await assertTicketInTeam(ctx, id, teamId))
  return tickets
}

export const bulkUpdateStatus = mutation({
  args: {
    ticketIds: v.array(v.id('tickets')),
    status: TICKET_STATUS,
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const tickets = await loadTeamTickets(ctx, args.ticketIds, teamId)
    const moving = tickets.filter(t => t.status !== args.status)
    await assertWipCapacity(ctx, teamId, args.status, moving.length)
    for (const t of moving) {
      await ctx.db.patch(t._id, { status: args.status, updatedAt: Date.now() })
      await appendActivityEvent(ctx, {
        teamId,
        userId,
        kind: 'ticket.status_changed',
        refType: 'ticket',
        refId: t._id,
        ticketId: t._id,
        payload: { from: t.status, to: args.status },
      })
      await notifyWatchers(ctx, t._id, userId, 'ticket.status_changed', { from: t.status, to: args.status })
    }
  },
})

export const bulkUpdateAssignee = mutation({
  args: {
    ticketIds: v.array(v.id('tickets')),
    assigneeId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const caller = await requireTeam(ctx)
    const { userId, teamId, email } = caller
    const tickets = await loadTeamTickets(ctx, args.ticketIds, teamId)
    const assigneeId = args.assigneeId ? await resolveAssignee(ctx, teamId, args.assigneeId) : undefined
    for (const t of tickets) assertCanAssign(t, caller, assigneeId)

    for (const t of tickets) {
      if ((t.assigneeId ?? undefined) === assigneeId) continue
      await ctx.db.patch(t._id, { assigneeId, updatedAt: Date.now() })
      await appendActivityEvent(ctx, {
        teamId,
        userId,
        kind: 'ticket.assigned',
        refType: 'ticket',
        refId: t._id,
        ticketId: t._id,
        payload: { assigneeId: assigneeId ?? null, assignedByEmail: email },
      })
      await notifyWatchers(ctx, t._id, userId, 'ticket.assigned', { assigneeId: assigneeId ?? null })
      if (assigneeId) {
        await ensureWatcher(ctx, t._id, assigneeId)
        await ctx.scheduler.runAfter(0, internal.email.sendAssignmentNotification, {
          ticketId: t._id,
          assigneeId,
          assignedByUserId: userId,
        })
      }
    }
  },
})

export const bulkUpdatePriority = mutation({
  args: {
    ticketIds: v.array(v.id('tickets')),
    priority: TICKET_PRIORITY,
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const tickets = await loadTeamTickets(ctx, args.ticketIds, teamId)
    for (const t of tickets) {
      if (t.priority === args.priority) continue
      await ctx.db.patch(t._id, { priority: args.priority, updatedAt: Date.now() })
      await appendActivityEvent(ctx, {
        teamId,
        userId,
        kind: 'ticket.updated',
        refType: 'ticket',
        refId: t._id,
        ticketId: t._id,
        payload: { priority: args.priority },
      })
      await notifyWatchers(ctx, t._id, userId, 'ticket.updated', { priority: args.priority })
    }
  },
})

export const bulkDelete = mutation({
  args: {
    ticketIds: v.array(v.id('tickets')),
  },
  handler: async (ctx, args) => {
    const caller = await requireTeam(ctx)
    const { userId, teamId } = caller
    const tickets = await loadTeamTickets(ctx, args.ticketIds, teamId)
    for (const t of tickets) assertCanDelete(t, caller)

    for (const t of tickets) {
      await notifyWatchers(ctx, t._id, userId, 'ticket.deleted', { key: t.key, title: t.title })
      await deleteTicketCascade(ctx, t)
      await appendActivityEvent(ctx, {
        teamId,
        userId,
        kind: 'ticket.deleted',
        refType: 'ticket',
        refId: t._id,
        ticketId: t._id,
        payload: { key: t.key, title: t.title },
      })
    }
  },
})
