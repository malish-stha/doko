import { v } from 'convex/values'
import { mutation, query, internalMutation, MutationCtx } from './_generated/server'
import { internal } from './_generated/api'
import {
  authError,
  findUser,
  getMembership,
  listMemberships,
  normalizeEmail,
  optionalTeam,
  requireRole,
  requireUser,
} from './teamHelper'

/** The caller's active team (see teamHelper.optionalTeam), or null. */
export const myTeam = query({
  args: {},
  handler: async ctx => {
    const team = await optionalTeam(ctx)
    if (!team) return null
    return await ctx.db.get(team.teamId)
  },
})

/**
 * Every team the caller belongs to, with role and whether it is the active
 * one. An empty list means the user still needs onboarding.
 */
export const myTeams = query({
  args: {},
  handler: async ctx => {
    const { userId, email } = await requireUser(ctx)
    const active = await optionalTeam(ctx)
    const memberships = await listMemberships(ctx, userId, email)

    const rows = await Promise.all(
      memberships.map(async m => {
        const team = await ctx.db.get(m.teamId)
        if (!team) return null
        return {
          teamId: m.teamId,
          name: team.name,
          slug: team.slug,
          role: m.role,
          joinedAt: m.joinedAt,
          isActive: active?.teamId === m.teamId,
        }
      }),
    )

    return rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.joinedAt - b.joinedAt)
  },
})

/** Switches the caller's active team. Requires an existing membership. */
export const setActiveTeam = mutation({
  args: { teamId: v.id('teams') },
  handler: async (ctx, args) => {
    const { userId, email, name, user } = await requireUser(ctx)
    const membership = await getMembership(ctx, args.teamId, userId, email)
    if (!membership) {
      throw authError('NOT_A_MEMBER', 'You are not a member of that team.')
    }
    const team = await ctx.db.get(args.teamId)
    if (!team) throw authError('NOT_FOUND', 'Team not found.')

    if (user) {
      await ctx.db.patch(user._id, { teamId: args.teamId })
    } else {
      await ctx.db.insert('users', {
        userId,
        email,
        name: name ?? email,
        timezone: 'UTC',
        teamId: args.teamId,
        createdAt: Date.now(),
      })
    }
    return { teamId: args.teamId, teamName: team.name }
  },
})

/** Slugifies `name` and appends -2, -3, ... until no team owns the slug. */
async function uniqueSlug(ctx: MutationCtx, name: string) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'team'

  let candidate = base
  for (let i = 2; ; i++) {
    const taken = await ctx.db
      .query('teams')
      .withIndex('by_slug', q => q.eq('slug', candidate))
      .first()
    if (!taken) return candidate
    candidate = `${base}-${i}`
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    workspaceDomain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, email, name: identityName, user } = await requireUser(ctx)
    if (!args.name.trim()) throw new Error('Team name required')

    const slug = await uniqueSlug(ctx, args.name)

    const cleanDomain = args.workspaceDomain
      ? args.workspaceDomain.trim().toLowerCase().replace(/^@/, '')
      : undefined

    const teamId = await ctx.db.insert('teams', {
      slug,
      name: args.name,
      ownerId: userId,
      workspaceDomain: cleanDomain,
      createdAt: Date.now(),
    })

    await ctx.db.insert('teamMembers', {
      teamId,
      userId,
      email,
      role: 'owner',
      joinedAt: Date.now(),
    })

    if (user) {
      await ctx.db.patch(user._id, { teamId })
    } else {
      await ctx.db.insert('users', {
        userId,
        email,
        name: identityName ?? email,
        timezone: 'UTC',
        teamId,
        createdAt: Date.now(),
      })
    }

    await ctx.db.insert('channels', {
      teamId: teamId as string,
      name: 'general',
      isPrivate: false,
      kind: 'public',
      memberIds: [userId],
      createdAt: Date.now(),
    })

    return teamId
  },
})

export const update = mutation({
  args: {
    name: v.optional(v.string()),
    workspaceDomain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { teamId } = await requireRole(ctx, ['owner', 'admin'])

    const updates: Record<string, any> = {}
    if (args.name !== undefined) {
      if (!args.name.trim()) throw new Error('Team name cannot be empty')
      updates.name = args.name.trim()
    }
    if (args.workspaceDomain !== undefined) {
      const clean = args.workspaceDomain.trim().toLowerCase().replace(/^@/, '')
      updates.workspaceDomain = clean.length > 0 ? clean : undefined
    }

    await ctx.db.patch(teamId, updates)
  },
})

/**
 * Deletes a team. The synchronous part only touches the small, user-facing
 * rows (memberships, invites, the team itself) so members lose access
 * immediately; everything else is purged in bounded batches by
 * purgeTeamData, which reschedules itself until the team's data is gone.
 */
export const deleteTeam = mutation({
  args: {},
  handler: async ctx => {
    const { teamId } = await requireRole(ctx, ['owner'])

    const members = await ctx.db
      .query('teamMembers')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .collect()
    for (const m of members) {
      await ctx.db.delete(m._id)
      const email = normalizeEmail(m.email)
      const user = await findUser(ctx, m.userId, email)
      if (user && (!user.teamId || user.teamId === teamId)) {
        const remaining = (await listMemberships(ctx, m.userId, email))
          .filter(x => x.teamId !== teamId)
          .sort((a, b) => a.joinedAt - b.joinedAt)
        await ctx.db.patch(user._id, { teamId: remaining[0]?.teamId })
      }
    }

    const invites = await ctx.db
      .query('invites')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .collect()
    for (const inv of invites) {
      await ctx.db.delete(inv._id)
    }

    await ctx.db.delete(teamId)
    await ctx.scheduler.runAfter(0, internal.teams.purgeTeamData, { teamId })
  },
})

const PURGE_BATCH = 100

/**
 * Removes one batch of a deleted team's data per invocation and reschedules
 * itself while anything remains. Safe to run repeatedly.
 */
export const purgeTeamData = internalMutation({
  args: { teamId: v.id('teams') },
  handler: async (ctx, { teamId }): Promise<{ done: boolean }> => {
    const teamKey = teamId as string
    let more = false

    // Chat: messages (+ reactions) per channel, then the channel.
    const channels = await ctx.db
      .query('channels')
      .withIndex('by_team', q => q.eq('teamId', teamKey))
      .take(10)
    for (const channel of channels) {
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_channel_created', q => q.eq('channelId', channel._id))
        .take(PURGE_BATCH)
      for (const message of messages) {
        const reactions = await ctx.db
          .query('reactions')
          .withIndex('by_message', q => q.eq('messageId', message._id))
          .collect()
        for (const r of reactions) await ctx.db.delete(r._id)
        await ctx.db.delete(message._id)
      }
      if (messages.length === PURGE_BATCH) {
        more = true
      } else {
        await ctx.db.delete(channel._id)
      }
    }
    if (channels.length === 10) more = true

    // Tickets and everything hanging off them.
    const tickets = await ctx.db
      .query('tickets')
      .withIndex('by_team_status', q => q.eq('teamId', teamKey))
      .take(PURGE_BATCH)
    for (const ticket of tickets) {
      const comments = await ctx.db
        .query('comments')
        .withIndex('by_ticket', q => q.eq('ticketId', ticket._id))
        .collect()
      for (const c of comments) await ctx.db.delete(c._id)
      const subtasks = await ctx.db
        .query('subtasks')
        .withIndex('by_ticket', q => q.eq('ticketId', ticket._id))
        .collect()
      for (const s of subtasks) await ctx.db.delete(s._id)
      const watchers = await ctx.db
        .query('watchers')
        .withIndex('by_ticket', q => q.eq('ticketId', ticket._id))
        .collect()
      for (const w of watchers) await ctx.db.delete(w._id)
      const attachments = await ctx.db
        .query('attachments')
        .withIndex('by_ticket', q => q.eq('ticketId', ticket._id))
        .collect()
      for (const a of attachments) {
        await ctx.db.delete(a._id)
        try {
          await ctx.storage.delete(a.storageId)
        } catch {
          // blob already gone
        }
      }
      const outgoing = await ctx.db
        .query('ticketLinks')
        .withIndex('by_source', q => q.eq('sourceId', ticket._id))
        .collect()
      const incoming = await ctx.db
        .query('ticketLinks')
        .withIndex('by_target', q => q.eq('targetId', ticket._id))
        .collect()
      for (const l of [...outgoing, ...incoming]) await ctx.db.delete(l._id)
      await ctx.db.delete(ticket._id)
    }
    if (tickets.length === PURGE_BATCH) more = true

    const sprints = await ctx.db
      .query('sprints')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .take(PURGE_BATCH)
    for (const s of sprints) await ctx.db.delete(s._id)
    if (sprints.length === PURGE_BATCH) more = true

    const events = await ctx.db
      .query('activityEvents')
      .withIndex('by_team_ts', q => q.eq('teamId', teamKey))
      .take(PURGE_BATCH)
    for (const e of events) await ctx.db.delete(e._id)
    if (events.length === PURGE_BATCH) more = true

    const configs = await ctx.db
      .query('boardConfig')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .collect()
    for (const c of configs) await ctx.db.delete(c._id)

    const filters = await ctx.db
      .query('savedFilters')
      .withIndex('by_team_scope_shared', q => q.eq('teamId', teamId))
      .take(PURGE_BATCH)
    for (const f of filters) await ctx.db.delete(f._id)
    if (filters.length === PURGE_BATCH) more = true

    if (more) {
      await ctx.scheduler.runAfter(0, internal.teams.purgeTeamData, { teamId })
    }
    return { done: !more }
  },
})
