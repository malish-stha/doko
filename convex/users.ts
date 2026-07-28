import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

function makeThumbsAvatarUrl(seed: string): string {
  const cleanSeed = encodeURIComponent(seed.trim().toLowerCase() || 'doko-user')
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${cleanSeed}`
}

export const me = query({
  args: { email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    const email = identity?.email ?? args.email
    if (!email) return null
    const key = identity?.subject ?? email.trim().toLowerCase()
    const user = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', key))
      .first()

    if (!user) return null
    return {
      ...user,
      avatarUrl: user.avatarUrl || makeThumbsAvatarUrl(user.email || user.userId),
    }
  },
})

export const upsert = mutation({
  args: {
    timezone: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    const rawEmail = identity?.email ?? args.email
    if (!rawEmail) return null
    const email = rawEmail.trim().toLowerCase()
    const userId = identity?.subject ?? email
    const name = identity?.name ?? args.name ?? email

    const existing = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .first()

    const defaultAvatarUrl = makeThumbsAvatarUrl(email || userId)

    if (existing) {
      if (!existing.avatarUrl) {
        await ctx.db.patch(existing._id, { timezone: args.timezone, email, name, avatarUrl: defaultAvatarUrl })
      } else {
        await ctx.db.patch(existing._id, { timezone: args.timezone, email, name })
      }
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
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    const currentEmail = (identity?.email ?? args.userEmail)?.trim().toLowerCase()

    let targetUser = null
    if (args.targetUserId) {
      targetUser = await ctx.db
        .query('users')
        .withIndex('by_userId', q => q.eq('userId', args.targetUserId!))
        .first()

      if (!targetUser) {
        const allUsers = await ctx.db.query('users').collect()
        targetUser = allUsers.find(u => u.userId === args.targetUserId || u.email.trim().toLowerCase() === args.targetUserId!.trim().toLowerCase()) ?? null
      }
    }

    if (!targetUser && currentEmail) {
      const key = identity?.subject ?? currentEmail
      targetUser = await ctx.db
        .query('users')
        .withIndex('by_userId', q => q.eq('userId', key))
        .first()

      if (!targetUser) {
        const allUsers = await ctx.db.query('users').collect()
        targetUser = allUsers.find(u => u.email.trim().toLowerCase() === currentEmail) ?? null
      }
    }

    if (!targetUser) return null

    const isSelf = Boolean(
      (identity?.subject && targetUser.userId === identity.subject) ||
        (currentEmail && targetUser.email.trim().toLowerCase() === currentEmail),
    )

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
    userEmail: v.optional(v.string()),
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
    const identity = await ctx.auth.getUserIdentity()
    const cleanEmail = (identity?.email ?? args.userEmail)?.trim().toLowerCase()
    if (!cleanEmail) throw new Error('Not authenticated')

    const userId = identity?.subject ?? cleanEmail
    let user = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .first()

    if (!user) {
      const allUsers = await ctx.db.query('users').collect()
      user = allUsers.find(u => u.email.trim().toLowerCase() === cleanEmail) ?? null
    }

    if (!user) throw new Error('User record not found')

    const { userEmail: _userEmail, ...patchData } = args

    const cleanPatch: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(patchData)) {
      if (val !== undefined) {
        cleanPatch[k] = val
      }
    }

    await ctx.db.patch(user._id, cleanPatch)
    return user._id
  },
})
