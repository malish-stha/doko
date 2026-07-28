import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { requireTeam, getMembership } from './teamHelper'
import { appendActivityEvent } from './events'
import * as jose from 'jose'

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

async function signInviteToken(payload: { teamId: string; email: string; exp: number }) {
  const secretStr = process.env.INVITE_SIGNING_SECRET ?? 'doko_default_invite_secret_key_32_bytes_long'
  const secret = new TextEncoder().encode(secretStr)
  return await new jose.SignJWT(payload as any).setProtectedHeader({ alg: 'HS256' }).sign(secret)
}

export const send = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const { userId, user, teamId, identity } = await requireTeam(ctx)
    if (!teamId) throw new Error('No active team')

    const membership = await getMembership(ctx, teamId, userId, user?.email ?? identity?.email)

    if (membership?.role !== 'owner' && membership?.role !== 'admin') {
      throw new Error('Only owners/admins can invite members')
    }

    const inviteEmail = args.email.trim().toLowerCase()

    // 1. Prevent inviting an existing team member
    const existingMember = await ctx.db
      .query('teamMembers')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .filter(f => f.eq(f.field('email'), inviteEmail))
      .first()
    if (existingMember) {
      throw new Error('This email address is already a member of this team')
    }

    // 2. Prevent duplicate active pending invites
    const existing = await ctx.db
      .query('invites')
      .withIndex('by_email_status', q => q.eq('email', inviteEmail).eq('status', 'pending'))
      .first()
    if (existing) throw new Error('An active invite has already been sent to this email')

    const team = await ctx.db.get(teamId)
    if (!team) throw new Error('Team not found')

    if (team.workspaceDomain) {
      const cleanDomain = team.workspaceDomain.trim().toLowerCase().replace(/^@/, '')
      if (!inviteEmail.endsWith(`@${cleanDomain}`)) {
        throw new Error(`Email must be from @${cleanDomain}`)
      }
    }

    const expiresAt = Date.now() + INVITE_EXPIRY_MS
    const token = await signInviteToken({
      teamId: teamId as string,
      email: inviteEmail,
      exp: Math.floor(expiresAt / 1000),
    })

    const myEmail = identity?.email ?? user?.email ?? `${userId}@doko.internal`
    const id = await ctx.db.insert('invites', {
      teamId,
      teamName: team.name,
      email: inviteEmail,
      token,
      invitedBy: userId,
      invitedByEmail: myEmail,
      status: 'pending',
      expiresAt,
      createdAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      kind: 'invite.sent',
      refType: 'invite',
      refId: id,
      payload: { email: inviteEmail },
    })

    await ctx.scheduler.runAfter(0, internal.email.sendInvite, { inviteId: id })
    return id
  },
})

export const pendingForMe = query({
  args: {},
  handler: async ctx => {
    const { user, identity } = await requireTeam(ctx)
    const email = (identity?.email ?? user?.email ?? '').trim().toLowerCase()
    if (!email) return []
    return await ctx.db
      .query('invites')
      .withIndex('by_email_status', q => q.eq('email', email).eq('status', 'pending'))
      .collect()
  },
})

export const accept = mutation({
  args: {
    inviteId: v.id('invites'),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId)
    if (!invite) throw new Error('Invite not found')
    if (invite.status !== 'pending') throw new Error('Invite already handled')
    if (invite.expiresAt < Date.now()) throw new Error('Invite expired')

    const { userId: reqUserId, user: reqUser, identity } = await requireTeam(ctx)
    const rawEmail = identity?.email ?? args.userEmail ?? invite.email
    const email = rawEmail.trim().toLowerCase()
    const userId = identity?.subject ?? email

    await ctx.db.insert('teamMembers', {
      teamId: invite.teamId,
      userId,
      email,
      role: 'member',
      joinedAt: Date.now(),
    })

    let user = reqUser
    if (!user) {
      user = await ctx.db
        .query('users')
        .withIndex('by_userId', q => q.eq('userId', userId))
        .first()
    }

    if (user) {
      await ctx.db.patch(user._id, { teamId: invite.teamId, email })
    } else {
      await ctx.db.insert('users', {
        userId,
        email,
        name: args.userName ?? identity?.name ?? email,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        teamId: invite.teamId,
        createdAt: Date.now(),
      })
    }

    await ctx.db.patch(args.inviteId, { status: 'accepted' })
    await appendActivityEvent(ctx, {
      kind: 'invite.accepted',
      refType: 'invite',
      refId: args.inviteId,
      payload: { email },
    })

    return invite.teamId
  },
})

export const revoke = mutation({
  args: { inviteId: v.id('invites') },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    const invite = await ctx.db.get(args.inviteId)
    if (!invite || invite.teamId !== teamId) throw new Error('Invite not found')
    await ctx.db.patch(args.inviteId, { status: 'revoked' })
  },
})

export const listForTeam = query({
  args: {},
  handler: async ctx => {
    const { teamId } = await requireTeam(ctx)
    if (!teamId) return []
    const allInvites = await ctx.db
      .query('invites')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .collect()

    return allInvites.filter(
      inv => inv.status === 'pending' && inv.expiresAt > Date.now(),
    )
  },
})
