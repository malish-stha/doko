import { v } from 'convex/values'
import { mutation, query, internalQuery } from './_generated/server'
import { findUser, requireUser } from './teamHelper'

export const getByUserIdInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .first()
  },
})

export const getByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .first()
  },
})


function makeThumbsAvatarUrl(seed: string): string {
  const cleanSeed = encodeURIComponent(seed.trim().toLowerCase() || 'doko-user')
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${cleanSeed}`
}

export const me = query({
  args: {},
  handler: async ctx => {
    const { user } = await requireUser(ctx)
    if (!user) return null
    return {
      ...user,
      avatarUrl: user.avatarUrl || makeThumbsAvatarUrl(user.email || user.userId),
    }
  },
})

/**
 * Creates or refreshes the caller's `users` row from the verified identity.
 * The row is keyed on the token subject; email and name come from the token,
 * never from the client.
 */
export const upsert = mutation({
  args: {
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, email, name: identityName, user: existing } = await requireUser(ctx)
    const name = identityName ?? existing?.name ?? email

    const defaultAvatarUrl = makeThumbsAvatarUrl(email || userId)

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId,
        timezone: args.timezone,
        email,
        name,
        ...(existing.avatarUrl ? {} : { avatarUrl: defaultAvatarUrl }),
      })
      return existing._id
    }

    return await ctx.db.insert('users', {
      userId,
      email,
      name,
      timezone: args.timezone,
      avatarUrl: defaultAvatarUrl,
      createdAt: Date.now(),
    })
  },
})

export const getProfile = query({
  args: {
    targetUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, email, user: self } = await requireUser(ctx)

    let targetUser = null
    if (args.targetUserId) {
      const target = args.targetUserId.trim()
      targetUser = await findUser(ctx, target, target.toLowerCase())
    } else {
      targetUser = self
    }

    if (!targetUser) return null

    const isSelf =
      targetUser.userId === userId || targetUser.email.trim().toLowerCase() === email

    let teamInfo = null
    if (targetUser.teamId) {
      const team = await ctx.db.get(targetUser.teamId)
      const membership = await ctx.db
        .query('teamMembers')
        .withIndex('by_team', q => q.eq('teamId', targetUser.teamId!))
        .collect()
      const member = membership.find(
        m =>
          m.userId === targetUser!.userId ||
          m.email.trim().toLowerCase() === targetUser!.email.trim().toLowerCase(),
      )
      if (team) {
        teamInfo = {
          teamId: team._id,
          teamName: team.name,
          role: member?.role ?? 'member',
          joinedAt: member?.joinedAt ?? team.createdAt,
          workspaceDomain: team.workspaceDomain,
        }
      }
    }

    return {
      ...targetUser,
      avatarUrl: targetUser.avatarUrl || makeThumbsAvatarUrl(targetUser.email || targetUser.userId),
      isSelf,
      teamInfo,
    }
  },
})

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    timezone: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    department: v.optional(v.string()),
    bio: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx)
    if (!user) throw new Error('User record not found')

    const cleanPatch: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(args)) {
      if (val !== undefined) {
        cleanPatch[k] = val
      }
    }

    await ctx.db.patch(user._id, cleanPatch)
    return user._id
  },
})
