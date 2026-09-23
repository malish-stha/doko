import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { appendActivityEvent } from './events'
import { Ctx, authError, getMembership, isAdminRole, normalizeEmail, requireTeam } from './teamHelper'
import { Doc, Id } from './_generated/dataModel'

const CHANNEL_NAME = /^[a-z0-9][a-z0-9-]{0,39}$/

/**
 * Public channels are open to every team member; private channels and DMs
 * are visible only to the users listed in memberIds.
 */
export function canAccessChannel(channel: Doc<'channels'>, userId: string) {
  if (channel.kind === 'public' || (!channel.kind && !channel.isPrivate)) return true
  return channel.memberIds.includes(userId)
}

/** Loads a channel and asserts it belongs to `teamId` and is visible to `userId`. */
export async function assertChannelAccess(
  ctx: Ctx,
  channelId: Id<'channels'>,
  teamId: Id<'teams'>,
  userId: string,
): Promise<Doc<'channels'>> {
  const channel = await ctx.db.get(channelId)
  if (!channel || channel.teamId !== (teamId as string) || !canAccessChannel(channel, userId)) {
    throw authError('NOT_FOUND', 'Channel not found.')
  }
  return channel
}

function normalizeChannelName(raw: string) {
  return raw.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-')
}

async function findChannelByName(ctx: Ctx, teamId: Id<'teams'>, name: string) {
  const channels = await ctx.db
    .query('channels')
    .withIndex('by_team', q => q.eq('teamId', teamId as string))
    .collect()
  return channels.find(c => c.kind !== 'dm' && c.name === name) ?? null
}

export const byTeam = query({
  args: {},
  handler: async ctx => {
    const { teamId, userId } = await requireTeam(ctx)
    const chans = await ctx.db
      .query('channels')
      .withIndex('by_team', q => q.eq('teamId', teamId as string))
      .collect()
    return chans
      .filter(c => c.kind !== 'dm' && canAccessChannel(c, userId))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
})

async function getDMName(ctx: Ctx, teamId: string, otherUserId?: string, fallbackName?: string) {
  if (!otherUserId) return fallbackName ?? 'Direct Message'
  const otherUser = await ctx.db
    .query('users')
    .withIndex('by_userId', q => q.eq('userId', otherUserId))
    .first()
  if (otherUser?.name) return otherUser.name

  const member = await getMembership(ctx, teamId as Id<'teams'>, otherUserId, otherUserId)
  if (member?.email) return member.email.split('@')[0]

  return fallbackName ?? 'Direct Message'
}

export const get = query({
  args: { channelId: v.id('channels') },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const chan = await ctx.db.get(args.channelId)
    if (!chan || chan.teamId !== (teamId as string) || !canAccessChannel(chan, userId)) return null

    if (chan.kind === 'dm') {
      const otherUserId = chan.memberIds.find(m => m !== userId)
      const name = await getDMName(ctx, chan.teamId, otherUserId, chan.name)
      return { ...chan, name }
    }
    return chan
  },
})

export const myDMs = query({
  args: {},
  handler: async ctx => {
    const { userId, teamId } = await requireTeam(ctx)

    const dms = await ctx.db
      .query('channels')
      .withIndex('by_team_kind', q => q.eq('teamId', teamId as string).eq('kind', 'dm'))
      .collect()

    const mine = dms.filter(c => c.memberIds.includes(userId))

    const enriched = await Promise.all(
      mine.map(async c => {
        const otherUserId = c.memberIds.find(m => m !== userId)
        const name = await getDMName(ctx, c.teamId, otherUserId, c.name)
        const lastMsg = await ctx.db
          .query('messages')
          .withIndex('by_channel_created', q => q.eq('channelId', c._id))
          .order('desc')
          .first()
        return {
          ...c,
          name,
          lastMessageAt: lastMsg?.createdAt ?? c.createdAt,
        }
      })
    )

    return enriched.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    isPrivate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)

    const name = normalizeChannelName(args.name)
    if (!CHANNEL_NAME.test(name)) {
      throw authError(
        'FORBIDDEN',
        'Channel names are 1-40 characters of lowercase letters, numbers and dashes.',
      )
    }
    if (await findChannelByName(ctx, teamId, name)) {
      throw authError('FORBIDDEN', `#${name} already exists in this team.`)
    }

    const isPrivate = args.isPrivate ?? false
    const id = await ctx.db.insert('channels', {
      teamId: teamId as string,
      name,
      isPrivate,
      kind: isPrivate ? 'private' : 'public',
      memberIds: [userId],
      createdAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'channel.created',
      refType: 'channel',
      refId: id,
      payload: { name, kind: isPrivate ? 'private' : 'public' },
    })

    return id
  },
})

/** Join a public channel (adds the caller to memberIds for notifications/lists). */
export const join = mutation({
  args: { channelId: v.id('channels') },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const channel = await ctx.db.get(args.channelId)
    if (!channel || channel.teamId !== (teamId as string) || channel.kind === 'dm') {
      throw authError('NOT_FOUND', 'Channel not found.')
    }
    if (channel.kind === 'private' && !channel.memberIds.includes(userId)) {
      throw authError('FORBIDDEN', 'Ask a member of this private channel to add you.')
    }
    if (!channel.memberIds.includes(userId)) {
      await ctx.db.patch(channel._id, { memberIds: [...channel.memberIds, userId] })
    }
    return channel._id
  },
})

/**
 * Add a teammate to a channel. Private channels: any current member (or a
 * team admin) may add; public channels: anyone on the team.
 */
export const addMember = mutation({
  args: { channelId: v.id('channels'), userId: v.string() },
  handler: async (ctx, args) => {
    const { userId, teamId, role } = await requireTeam(ctx)
    const channel = await ctx.db.get(args.channelId)
    if (!channel || channel.teamId !== (teamId as string) || channel.kind === 'dm') {
      throw authError('NOT_FOUND', 'Channel not found.')
    }
    if (channel.kind === 'private' && !channel.memberIds.includes(userId) && !isAdminRole(role)) {
      throw authError('FORBIDDEN', 'Only members of this private channel can add people.')
    }

    const target = await getMembership(ctx, teamId, args.userId.trim(), args.userId)
    if (!target) throw authError('NOT_A_MEMBER', 'That person is not on this team.')

    if (!channel.memberIds.includes(target.userId)) {
      await ctx.db.patch(channel._id, { memberIds: [...channel.memberIds, target.userId] })
    }
    return channel._id
  },
})

export const openDM = mutation({
  args: { otherUserId: v.string() },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)

    // Resolve the other side to their canonical membership id, whatever the caller passed.
    const otherMembership = await getMembership(
      ctx,
      teamId,
      args.otherUserId.trim(),
      normalizeEmail(args.otherUserId),
    )
    if (!otherMembership) throw authError('NOT_A_MEMBER', 'That person is not on this team.')

    const otherUserId = otherMembership.userId
    if (otherUserId === userId) throw authError('FORBIDDEN', 'You cannot message yourself.')

    const sorted = [userId, otherUserId].sort()
    const dmKey = `dm:${teamId}:${sorted[0]}:${sorted[1]}`

    // Mutations are serialisable in Convex, so read-then-insert cannot race.
    const existing = await ctx.db
      .query('channels')
      .withIndex('by_dm_key', q => q.eq('dmKey', dmKey))
      .first()
    if (existing) return existing._id

    const otherUser = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', otherUserId))
      .first()
    const label = otherUser?.name ?? otherMembership.email.split('@')[0]

    const id = await ctx.db.insert('channels', {
      teamId: teamId as string,
      name: label,
      isPrivate: true,
      kind: 'dm',
      memberIds: sorted,
      dmKey,
      createdAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'channel.created',
      refType: 'channel',
      refId: id,
      payload: { name: label, kind: 'dm' },
    })

    return id
  },
})
