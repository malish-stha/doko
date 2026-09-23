import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { optionalTeam, requireRole, requireUser } from './teamHelper'

export const myTeam = query({
  args: {},
  handler: async ctx => {
    const team = await optionalTeam(ctx)
    if (!team) return null
    return await ctx.db.get(team.teamId)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    workspaceDomain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, email, name: identityName, user } = await requireUser(ctx)
    if (!args.name.trim()) throw new Error('Team name required')

    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

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
