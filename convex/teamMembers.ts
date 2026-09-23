import { v } from 'convex/values'
import { mutation, query, internalQuery, MutationCtx } from './_generated/server'
import { Id } from './_generated/dataModel'
import {
  authError,
  findUser,
  listMemberships,
  normalizeEmail,
  requireRole,
  requireTeam,
} from './teamHelper'

export const listForTeam = query({
  args: {},
  handler: async ctx => {
    const { teamId } = await requireTeam(ctx)
    const members = await ctx.db
      .query('teamMembers')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .collect()

    const users = await ctx.db.query('users').collect()
    const userMap = new Map(users.map(u => [u.userId, u]))
    const userEmailMap = new Map(users.map(u => [u.email.toLowerCase(), u]))

    return members.map(m => {
      const u = userMap.get(m.userId) ?? userEmailMap.get(m.email.toLowerCase())
      return {
        ...m,
        name: u?.name,
        avatarUrl: u?.avatarUrl,
      }
    })
  },
})

/**
 * Removes a user's footprint from a team they are leaving: channel
 * memberships and ticket watches scoped to that team. Their authored
 * content (messages, comments, tickets) is kept.
 */
async function detachFromTeam(ctx: MutationCtx, teamId: Id<'teams'>, userId: string, email: string) {
  const channels = await ctx.db
    .query('channels')
    .withIndex('by_team', q => q.eq('teamId', teamId as string))
    .collect()
  for (const channel of channels) {
    const remaining = channel.memberIds.filter(
      id => id !== userId && normalizeEmail(id) !== email,
    )
    if (remaining.length !== channel.memberIds.length) {
      await ctx.db.patch(channel._id, { memberIds: remaining })
    }
  }

  const watches = await ctx.db
    .query('watchers')
    .withIndex('by_user', q => q.eq('userId', userId))
    .collect()
  for (const watch of watches) {
    const ticket = await ctx.db.get(watch.ticketId)
    if (!ticket || ticket.teamId === (teamId as string)) {
      await ctx.db.delete(watch._id)
    }
  }
}

/**
 * After a membership is removed, point the user's active team at another
 * membership (earliest joined) or clear it when none remain.
 */
async function repointActiveTeam(ctx: MutationCtx, userId: string, email: string, removedTeamId: Id<'teams'>) {
  const user = await findUser(ctx, userId, email)
  if (!user) return
  if (user.teamId && user.teamId !== removedTeamId) {
    // Another team is already active; leave it alone.
    return
  }
  const remaining = (await listMemberships(ctx, userId, email))
    .filter(m => m.teamId !== removedTeamId)
    .sort((a, b) => a.joinedAt - b.joinedAt)
  await ctx.db.patch(user._id, { teamId: remaining[0]?.teamId })
}

export const remove = mutation({
  args: { memberId: v.id('teamMembers') },
  handler: async (ctx, args) => {
    const { teamId, membership: me } = await requireRole(ctx, ['owner'])

    const target = await ctx.db.get(args.memberId)
    if (!target || target.teamId !== teamId) throw new Error('Member not found')

    if (target._id === me._id) {
      throw new Error('Owner cannot remove themselves — transfer ownership first')
    }
    if (target.role === 'owner') {
      throw new Error('Cannot remove the team owner')
    }

    const targetEmail = normalizeEmail(target.email)
    await ctx.db.delete(args.memberId)
    await detachFromTeam(ctx, teamId, target.userId, targetEmail)
    await repointActiveTeam(ctx, target.userId, targetEmail, teamId)
  },
})

export const leave = mutation({
  args: {},
  handler: async ctx => {
    const { userId, email, teamId, membership: me } = await requireTeam(ctx)

    if (me.role === 'owner') {
      const others = await ctx.db
        .query('teamMembers')
        .withIndex('by_team', q => q.eq('teamId', teamId))
        .collect()
      if (others.length > 1) {
        throw new Error('Owner cannot leave — transfer ownership first')
      }
      throw new Error('You are the only member. Delete the team workspace instead.')
    }

    await ctx.db.delete(me._id)
    await detachFromTeam(ctx, teamId, userId, email)
    await repointActiveTeam(ctx, userId, email, teamId)
  },
})

export const changeRole = mutation({
  args: {
    memberId: v.id('teamMembers'),
    role: v.union(v.literal('admin'), v.literal('member')),
  },
  handler: async (ctx, args) => {
    const { teamId } = await requireRole(ctx, ['owner'])

    const target = await ctx.db.get(args.memberId)
    if (!target || target.teamId !== teamId) throw new Error('Member not found')
    if (target.role === 'owner') throw new Error('Cannot change owner role')

    await ctx.db.patch(args.memberId, { role: args.role })
  },
})

/**
 * Hands ownership to another member. The previous owner becomes an admin
 * so they can still manage the team (or leave) afterwards.
 */
export const transferOwnership = mutation({
  args: { memberId: v.id('teamMembers') },
  handler: async (ctx, args) => {
    const { teamId, membership: me } = await requireRole(ctx, ['owner'])

    const target = await ctx.db.get(args.memberId)
    if (!target || target.teamId !== teamId) {
      throw authError('NOT_FOUND', 'Member not found.')
    }
    if (target._id === me._id) {
      throw new Error('You already own this team')
    }

    await ctx.db.patch(target._id, { role: 'owner' })
    await ctx.db.patch(me._id, { role: 'admin' })
    await ctx.db.patch(teamId, { ownerId: target.userId })
    return { newOwnerId: target.userId, newOwnerEmail: target.email }
  },
})

/** Resolves a team member by canonical userId or email. Used by outbound email. */
export const resolveMember = internalQuery({
  args: { teamId: v.id('teams'), idOrEmail: v.string() },
  handler: async (ctx, args) => {
    const needle = args.idOrEmail.trim()
    const direct = await ctx.db
      .query('teamMembers')
      .withIndex('by_team_user', q => q.eq('teamId', args.teamId).eq('userId', needle))
      .first()
    if (direct) return direct
    const email = normalizeEmail(needle)
    const members = await ctx.db
      .query('teamMembers')
      .withIndex('by_team', q => q.eq('teamId', args.teamId))
      .collect()
    return members.find(m => normalizeEmail(m.email) === email) ?? null
  },
})
