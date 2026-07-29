import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { appendActivityEvent } from './events'
import { requireTeam } from './teamHelper'

export const byTeam = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) return []
    const chans = await ctx.db
      .query('channels')
      .withIndex('by_team', q => q.eq('teamId', teamId as string))
      .collect()
    return chans.filter(c => c.kind !== 'dm')
  },
})

async function getDMName(
  ctx: any,
  teamId: string,
  otherUserId?: string,
  fallbackName?: string
) {
  if (!otherUserId) return fallbackName ?? 'Direct Message'
  const otherUser = await ctx.db
    .query('users')
    .withIndex('by_userId', (q: any) => q.eq('userId', otherUserId))
    .first()
  if (otherUser?.name) return otherUser.name

  const members = await ctx.db
    .query('teamMembers')
    .withIndex('by_team', (q: any) => q.eq('teamId', teamId as any))
    .collect()
  const member = members.find(
    (m: any) => m.userId === otherUserId || m.email === otherUserId
  )
  if (member?.email) return member.email.split('@')[0]

  return fallbackName ?? 'Direct Message'
}

export const get = query({
  args: { channelId: v.id('channels'), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) return null
    const chan = await ctx.db.get(args.channelId)
    if (!chan || chan.teamId !== teamId) return null

    if (chan.kind === 'dm') {
      if (userId && !chan.memberIds.includes(userId)) {
        return null
      }
      if (userId) {
        const otherUserId = chan.memberIds.find(m => m !== userId)
        const name = await getDMName(ctx, chan.teamId, otherUserId, chan.name)
        return { ...chan, name }
      }
    }
    return chan
  },
})

export const myDMs = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId || !userId) return []

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
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) throw new Error('No team')
    if (!args.name.trim()) throw new Error('empty channel name')

    const normalizedName = args.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')

    const isPrivate = args.isPrivate ?? false
    const id = await ctx.db.insert('channels', {
      teamId: teamId as string,
      name: normalizedName,
      isPrivate,
      kind: isPrivate ? 'private' : 'public',
      memberIds: [userId],
      createdAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      kind: 'channel.created',
      refType: 'channel',
      refId: id,
      payload: { name: normalizedName },
    })

    return id
  },
})

export const openDM = mutation({
  args: { otherUserId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) throw new Error('No team')
    if (!userId) throw new Error('Not authenticated')
    if (args.otherUserId === userId) throw new Error('cannot DM yourself')

    const members = await ctx.db
      .query('teamMembers')
      .withIndex('by_team', q => q.eq('teamId', teamId as any))
      .collect()

    const otherMembership = members.find(
      m =>
        m.userId === args.otherUserId ||
        (m.email && m.email.trim().toLowerCase() === args.otherUserId.trim().toLowerCase())
    )
    if (!otherMembership) throw new Error('not a teammate')

    const cleanOtherUserId = otherMembership.userId ?? args.otherUserId
    if (cleanOtherUserId === userId) throw new Error('cannot DM yourself')

    const sorted = [userId, cleanOtherUserId].sort()
    const dmKey = `dm:${teamId}:${sorted[0]}:${sorted[1]}`

    const existing = await ctx.db
      .query('channels')
      .withIndex('by_dm_key', q => q.eq('dmKey', dmKey))
      .first()
    if (existing) return existing._id

    const otherUser = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', cleanOtherUserId))
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
      kind: 'channel.created',
      refType: 'channel',
      refId: id,
      payload: { name: label, kind: 'dm' },
    })

    return id
  },
})
