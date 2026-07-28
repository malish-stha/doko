import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTeam, getMembership } from './teamHelper'

export const myTeam = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId, user, identity } = await requireTeam(ctx, args.userEmail)
    if (!user?.teamId) return null

    const email = identity?.email ?? args.userEmail ?? user?.email
    const membership = await getMembership(ctx, user.teamId, userId, email)
    if (!membership) return null

    return await ctx.db.get(user.teamId)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    workspaceDomain: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId: reqUserId, user: reqUser, identity } = await requireTeam(ctx, args.userEmail)
    if (!args.name.trim()) throw new Error('Team name required')

    const rawEmail = identity?.email ?? args.userEmail ?? reqUser?.email ?? 'anonymous@doko.internal'
    const email = rawEmail.trim().toLowerCase()
    const userId = identity?.subject ?? email

    let user = reqUser
    if (!user) {
      user = await ctx.db
        .query('users')
        .withIndex('by_userId', q => q.eq('userId', userId))
        .first()
    }

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
      await ctx.db.patch(user._id, { teamId, email })
    } else {
      await ctx.db.insert('users', {
        userId,
        email,
        name: args.userName ?? identity?.name ?? email,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
    const { userId, teamId } = await requireTeam(ctx)
    if (!teamId) throw new Error('No active team')

    const membership = await ctx.db
      .query('teamMembers')
      .withIndex('by_user', q => q.eq('userId', userId))
      .filter(f => f.eq(f.field('teamId'), teamId))
      .first()

    if (membership?.role !== 'owner' && membership?.role !== 'admin') {
      throw new Error('Only owners/admins can update team settings')
    }

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
    const { userId, user, teamId, identity } = await requireTeam(ctx)
    if (!teamId) throw new Error('No active team')

    const email = identity?.email ?? user?.email
    const me = await getMembership(ctx, teamId, userId, email)

    if (me?.role !== 'owner') {
      throw new Error('Only team owner can delete the team')
    }

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
