import { v } from 'convex/values'
import { mutation, query, MutationCtx } from './_generated/server'
import {
  authError,
  getMembership,
  listMemberships,
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
    }

    const channels = await ctx.db
      .query('channels')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .collect()
    for (const c of channels) {
      await ctx.db.delete(c._id)
    }

    const invites = await ctx.db
      .query('invites')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .collect()
    for (const inv of invites) {
      await ctx.db.delete(inv._id)
    }

    const users = await ctx.db.query('users').collect()
    for (const u of users) {
      if (u.teamId === teamId) {
        await ctx.db.patch(u._id, { teamId: undefined })
      }
    }

    await ctx.db.delete(teamId)
  },
})
