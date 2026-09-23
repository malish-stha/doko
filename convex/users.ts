import { v } from 'convex/values'
import { mutation, query, internalQuery, QueryCtx } from './_generated/server'
import { Doc } from './_generated/dataModel'
import { authError, findUser, listMemberships, normalizeEmail, requireUser } from './teamHelper'
import { validateAvatarUrl, validateGithubUrl, validateLinkedinUrl } from './urlValidation'
import { isValidTimezone } from '../lib/time'

export const getByUserIdInternal = internalQuery({
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

/** True when `a` and `b` share at least one team. */
async function shareATeam(ctx: QueryCtx, a: { userId: string; email: string }, b: Doc<'users'>) {
  const mine = await listMemberships(ctx, a.userId, a.email)
  if (mine.length === 0) return false
  const theirs = await listMemberships(ctx, b.userId, normalizeEmail(b.email))
  const theirTeams = new Set(theirs.map(m => m.teamId))
  return mine.some(m => theirTeams.has(m.teamId))
}

/** Fields safe to show to teammates. Contact details stay private to the owner. */
function publicProfile(user: Doc<'users'>) {
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    userId: user.userId,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    teamId: user.teamId,
    jobTitle: user.jobTitle,
    department: user.department,
    bio: user.bio,
    avatarUrl: user.avatarUrl || makeThumbsAvatarUrl(user.email || user.userId),
    githubUrl: user.githubUrl,
    linkedinUrl: user.linkedinUrl,
    createdAt: user.createdAt,
  }
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
    // A bad zone would later crash the morning-brief cron for this user.
    const timezone = isValidTimezone(args.timezone) ? args.timezone : existing?.timezone ?? 'UTC'

    const defaultAvatarUrl = makeThumbsAvatarUrl(email || userId)

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId,
        timezone,
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
      timezone,
      avatarUrl: defaultAvatarUrl,
      createdAt: Date.now(),
    })
  },
})

/**
 * Minimal teammate card for mentions and avatars. Only resolves users who
 * share a team with the caller.
 */
export const getTeammate = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx)
    const target = await findUser(ctx, args.userId.trim(), normalizeEmail(args.userId))
    if (!target) return null
    const isSelf = target.userId === caller.userId || normalizeEmail(target.email) === caller.email
    if (!isSelf && !(await shareATeam(ctx, caller, target))) return null
    const pub = publicProfile(target)
    return {
      userId: pub.userId,
      name: pub.name,
      email: pub.email,
      avatarUrl: pub.avatarUrl,
      jobTitle: pub.jobTitle,
    }
  },
})

export const getProfile = query({
  args: {
    targetUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx)

    let targetUser: Doc<'users'> | null
    if (args.targetUserId) {
      const target = args.targetUserId.trim()
      targetUser = await findUser(ctx, target, normalizeEmail(target))
    } else {
      targetUser = caller.user
    }
    if (!targetUser) return null

    const isSelf =
      targetUser.userId === caller.userId || normalizeEmail(targetUser.email) === caller.email
    if (!isSelf && !(await shareATeam(ctx, caller, targetUser))) {
      // Not a teammate: behave exactly like an unknown user.
      return null
    }

    let teamInfo = null
    if (targetUser.teamId) {
      const team = await ctx.db.get(targetUser.teamId)
      const membership = await ctx.db
        .query('teamMembers')
        .withIndex('by_team', q => q.eq('teamId', targetUser!.teamId!))
        .collect()
      const member = membership.find(
        m =>
          m.userId === targetUser!.userId ||
          normalizeEmail(m.email) === normalizeEmail(targetUser!.email),
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
      ...publicProfile(targetUser),
      // Contact details are only returned to the profile's owner.
      phone: isSelf ? targetUser.phone : undefined,
      location: isSelf ? targetUser.location : undefined,
      isSelf,
      teamInfo,
    }
  },
})

/** Optional text field: a string sets it, null clears it, undefined leaves it alone. */
const clearable = v.optional(v.union(v.string(), v.null()))

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    timezone: v.optional(v.string()),
    jobTitle: clearable,
    department: clearable,
    bio: clearable,
    phone: clearable,
    location: clearable,
    avatarUrl: clearable,
    githubUrl: clearable,
    linkedinUrl: clearable,
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx)
    if (!user) throw authError('NOT_FOUND', 'User record not found')

    const patch: Partial<Doc<'users'>> = {}

    if (args.name !== undefined) {
      const name = args.name.trim()
      if (!name) throw authError('FORBIDDEN', 'Name cannot be empty.')
      patch.name = name.slice(0, 120)
    }
    if (args.timezone !== undefined) {
      if (!isValidTimezone(args.timezone)) throw authError('FORBIDDEN', `Unknown timezone: ${args.timezone}`)
      patch.timezone = args.timezone
    }

    const text = (key: 'jobTitle' | 'department' | 'bio' | 'phone' | 'location', max: number) => {
      const val = args[key]
      if (val === undefined) return
      patch[key] = val === null ? undefined : val.trim().slice(0, max) || undefined
    }
    text('jobTitle', 120)
    text('department', 120)
    text('bio', 2000)
    text('phone', 40)
    text('location', 120)

    if (args.avatarUrl !== undefined) {
      patch.avatarUrl = args.avatarUrl === null || !args.avatarUrl.trim() ? undefined : validateAvatarUrl(args.avatarUrl)
    }
    if (args.githubUrl !== undefined) {
      patch.githubUrl = args.githubUrl === null || !args.githubUrl.trim() ? undefined : validateGithubUrl(args.githubUrl)
    }
    if (args.linkedinUrl !== undefined) {
      patch.linkedinUrl =
        args.linkedinUrl === null || !args.linkedinUrl.trim() ? undefined : validateLinkedinUrl(args.linkedinUrl)
    }

    await ctx.db.patch(user._id, patch)
    return user._id
  },
})
