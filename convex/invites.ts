import { v } from 'convex/values'
import { mutation, query, internalQuery, internalMutation, MutationCtx } from './_generated/server'
import { internal } from './_generated/api'
import { Doc } from './_generated/dataModel'
import {
  AuthContext,
  authError,
  findUser,
  getMembership,
  normalizeEmail,
  requireAuth,
  requireRole,
  requireUser,
} from './teamHelper'
import { appendActivityEvent } from './events'
import { INVITE_EXPIRY_MS, signInviteToken, verifyInviteToken } from './inviteToken'

export const getById = internalQuery({
  args: { inviteId: v.id('invites') },
  handler: async (ctx, args) => await ctx.db.get(args.inviteId),
})

function domainOf(team: Doc<'teams'>) {
  return team.workspaceDomain?.trim().toLowerCase().replace(/^@/, '') || null
}

function assertDomainAllowed(team: Doc<'teams'>, email: string) {
  const domain = domainOf(team)
  if (domain && !email.endsWith(`@${domain}`)) {
    throw authError('FORBIDDEN', `Only @${domain} email addresses can join ${team.name}.`)
  }
}

/** Strips the secret token; the UI never needs it. */
function publicInvite(inv: Doc<'invites'>): Omit<Doc<'invites'>, 'token'> {
  const { token, ...rest } = inv
  void token
  return rest
}

export const send = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const { userId, email: myEmail, teamId } = await requireRole(ctx, ['owner', 'admin'])
    const inviteEmail = normalizeEmail(args.email)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      throw authError('FORBIDDEN', 'Enter a valid email address.')
    }

    const team = await ctx.db.get(teamId)
    if (!team) throw authError('NOT_FOUND', 'Team workspace not found.')
    assertDomainAllowed(team, inviteEmail)

    const existingMember = await ctx.db
      .query('teamMembers')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .filter(f => f.eq(f.field('email'), inviteEmail))
      .first()
    if (existingMember) {
      throw authError('FORBIDDEN', 'This email address is already a member of this team.')
    }

    // Duplicate check is scoped to this team: another workspace may invite the same person.
    const pendingHere = await ctx.db
      .query('invites')
      .withIndex('by_email_status', q => q.eq('email', inviteEmail).eq('status', 'pending'))
      .filter(f => f.eq(f.field('teamId'), teamId))
      .first()
    if (pendingHere) {
      throw authError('FORBIDDEN', 'An active invite has already been sent to this email for this team.')
    }

    const expiresAt = Date.now() + INVITE_EXPIRY_MS
    const token = await signInviteToken({ teamId, email: inviteEmail }, expiresAt)

    const id = await ctx.db.insert('invites', {
      teamId,
      teamName: team.name,
      email: inviteEmail,
      token,
      invitedBy: userId,
      invitedByEmail: myEmail,
      status: 'pending',
      deliveryStatus: 'queued',
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

/** Re-issues the token/expiry and queues the email again (owner/admin). */
export const resend = mutation({
  args: { inviteId: v.id('invites') },
  handler: async (ctx, args) => {
    const { teamId } = await requireRole(ctx, ['owner', 'admin'])
    const invite = await ctx.db.get(args.inviteId)
    if (!invite || invite.teamId !== teamId) throw authError('NOT_FOUND', 'Invite not found.')
    if (invite.status === 'accepted') throw authError('FORBIDDEN', 'This invite was already accepted.')

    const expiresAt = Date.now() + INVITE_EXPIRY_MS
    const token = await signInviteToken({ teamId, email: invite.email }, expiresAt)
    await ctx.db.patch(invite._id, {
      token,
      expiresAt,
      status: 'pending',
      deliveryStatus: 'queued',
      lastError: undefined,
    })
    await ctx.scheduler.runAfter(0, internal.email.sendInvite, { inviteId: invite._id })
  },
})

/** Invites addressed to the signed-in email. No team required (used on onboarding). */
export const pendingForMe = query({
  args: {},
  handler: async ctx => {
    const { email } = await requireAuth(ctx)
    const rows = await ctx.db
      .query('invites')
      .withIndex('by_email_status', q => q.eq('email', email).eq('status', 'pending'))
      .collect()
    return rows.filter(inv => inv.expiresAt > Date.now()).map(publicInvite)
  },
})

/**
 * Shared acceptance path for accept (by id) and acceptByToken. Verifies the
 * caller is the invitee, re-checks the team's domain rule, adds exactly one
 * membership, joins public channels, and makes the team active.
 */
async function acceptInvite(ctx: MutationCtx, invite: Doc<'invites'>, caller: AuthContext) {
  if (invite.status !== 'pending') {
    throw authError('FORBIDDEN', `This invite is no longer valid (${invite.status}).`)
  }
  if (invite.expiresAt < Date.now()) {
    throw authError('FORBIDDEN', 'This invite has expired. Ask the team admin to resend it.')
  }
  if (invite.email !== caller.email) {
    throw authError(
      'FORBIDDEN',
      `This invite was sent to ${invite.email}, but you are signed in as ${caller.email}.`,
    )
  }

  const team = await ctx.db.get(invite.teamId)
  if (!team) throw authError('NOT_FOUND', 'That team no longer exists.')
  assertDomainAllowed(team, caller.email)

  const existing = await getMembership(ctx, team._id, caller.userId, caller.email)
  if (!existing) {
    await ctx.db.insert('teamMembers', {
      teamId: team._id,
      userId: caller.userId,
      email: caller.email,
      role: 'member',
      joinedAt: Date.now(),
    })
  }

  const user = await findUser(ctx, caller.userId, caller.email)
  if (user) {
    await ctx.db.patch(user._id, { teamId: team._id, email: caller.email })
  } else {
    await ctx.db.insert('users', {
      userId: caller.userId,
      email: caller.email,
      name: caller.name ?? caller.email,
      timezone: 'UTC',
      teamId: team._id,
      createdAt: Date.now(),
    })
  }

  // Public channels are open to every member; make #general etc. show up immediately.
  const publicChannels = await ctx.db
    .query('channels')
    .withIndex('by_team_kind', q => q.eq('teamId', team._id as string).eq('kind', 'public'))
    .collect()
  for (const channel of publicChannels) {
    if (!channel.memberIds.includes(caller.userId)) {
      await ctx.db.patch(channel._id, { memberIds: [...channel.memberIds, caller.userId] })
    }
  }

  await ctx.db.patch(invite._id, { status: 'accepted' })
  await appendActivityEvent(ctx, {
    kind: 'invite.accepted',
    refType: 'invite',
    refId: invite._id,
    payload: { email: caller.email },
  })

  return { teamId: team._id, teamName: team.name, alreadyMember: Boolean(existing) }
}

/** Accept from the onboarding list (invite already shown to this user). */
export const accept = mutation({
  args: { inviteId: v.id('invites') },
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx)
    const invite = await ctx.db.get(args.inviteId)
    if (!invite) throw authError('NOT_FOUND', 'Invite not found.')
    return await acceptInvite(ctx, invite, caller)
  },
})

/** Accept from an emailed link: the JWT must verify before anything is looked up. */
export const acceptByToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx)
    const payload = await verifyInviteToken(args.token)
    if (!payload) {
      throw authError('FORBIDDEN', 'This invite link is invalid or has expired.')
    }
    const invite = await ctx.db
      .query('invites')
      .withIndex('by_token', q => q.eq('token', args.token))
      .first()
    if (!invite || invite.email !== payload.email || invite.teamId !== payload.teamId) {
      throw authError('NOT_FOUND', 'Invite not found. It may have been revoked or resent.')
    }
    return await acceptInvite(ctx, invite, caller)
  },
})

export const revoke = mutation({
  args: { inviteId: v.id('invites') },
  handler: async (ctx, args) => {
    const { teamId } = await requireRole(ctx, ['owner', 'admin'])
    const invite = await ctx.db.get(args.inviteId)
    if (!invite || invite.teamId !== teamId) throw authError('NOT_FOUND', 'Invite not found.')
    if (invite.status !== 'pending') {
      throw authError('FORBIDDEN', `Invite is already ${invite.status}.`)
    }
    await ctx.db.patch(args.inviteId, { status: 'revoked' })
  },
})

/** Open invites for the active team, without tokens (owner/admin only). */
export const listForTeam = query({
  args: {},
  handler: async ctx => {
    const { teamId } = await requireRole(ctx, ['owner', 'admin'])
    const rows = await ctx.db
      .query('invites')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .collect()
    return rows
      .filter(inv => inv.status === 'pending' || inv.status === 'expired')
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(publicInvite)
  },
})

/** Written by email.sendInvite so the UI can show queued / sent / failed. */
export const markDelivery = internalMutation({
  args: {
    inviteId: v.id('invites'),
    deliveryStatus: v.union(v.literal('queued'), v.literal('sent'), v.literal('failed')),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId)
    if (!invite) return
    await ctx.db.patch(args.inviteId, {
      deliveryStatus: args.deliveryStatus,
      lastError: args.deliveryStatus === 'failed' ? args.lastError : undefined,
    })
  },
})

/** Cron: flip stale pending invites to 'expired' (bounded batch per run). */
export const expireStale = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()
    const stale = await ctx.db
      .query('invites')
      .withIndex('by_status_expires', q => q.eq('status', 'pending').lt('expiresAt', now))
      .take(200)
    for (const inv of stale) {
      await ctx.db.patch(inv._id, { status: 'expired' })
    }
    return { expired: stale.length }
  },
})
