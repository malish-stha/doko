import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Ctx, authError, normalizeEmail, requireTeam } from './teamHelper'
import { Doc, Id } from './_generated/dataModel'

type ContextDetail =
  | { kind: 'ticket'; title: string; key: string; id: Id<'tickets'> }
  | { kind: 'comment'; commentBody: string; ticketKey: string; ticketTitle: string; ticketId: Id<'tickets'> }
  | { kind: 'message'; messageBody: string; channelName: string; channelId: Id<'channels'> }

/**
 * Resolves what a mention points at, scoped to `teamId`. Returns null when
 * the referenced document is gone, malformed, or belongs to another team,
 * so one bad row can never break the inbox.
 */
async function resolveContext(ctx: Ctx, m: Doc<'mentions'>, teamId: Id<'teams'>): Promise<ContextDetail | null> {
  const team = teamId
  if (m.contextRefType === 'ticket') {
    const id = ctx.db.normalizeId('tickets', m.contextRefId)
    const t = id ? await ctx.db.get(id) : null
    if (!t || t.teamId !== team) return null
    return { kind: 'ticket', title: t.title, key: t.key, id: t._id }
  }
  if (m.contextRefType === 'comment') {
    const id = ctx.db.normalizeId('comments', m.contextRefId)
    const comment = id ? await ctx.db.get(id) : null
    if (!comment) return null
    const ticket = await ctx.db.get(comment.ticketId)
    if (!ticket || ticket.teamId !== team) return null
    return {
      kind: 'comment',
      commentBody: comment.body,
      ticketKey: ticket.key,
      ticketTitle: ticket.title,
      ticketId: ticket._id,
    }
  }
  if (m.contextRefType === 'message') {
    const id = ctx.db.normalizeId('messages', m.contextRefId)
    const msg = id ? await ctx.db.get(id) : null
    if (!msg) return null
    const channel = await ctx.db.get(msg.channelId)
    if (!channel || channel.teamId !== team) return null
    return { kind: 'message', messageBody: msg.body, channelName: channel.name, channelId: channel._id }
  }
  return null
}

async function loadAuthor(ctx: Ctx, id: string) {
  return (
    (await ctx.db.query('users').withIndex('by_userId', q => q.eq('userId', id)).first()) ??
    (await ctx.db.query('users').withIndex('by_email', q => q.eq('email', normalizeEmail(id))).first())
  )
}

/** Notifications for the signed-in user, limited to the active team. */
export const forMe = query({
  args: { read: v.optional(v.boolean()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId, teamId } = await requireTeam(ctx)
    const limit = Math.min(200, Math.max(1, Math.floor(args.limit ?? 100)))

    const rows =
      args.read === undefined
        ? await ctx.db.query('mentions').withIndex('by_user', q => q.eq('mentionedUserId', userId)).order('desc').take(limit * 2)
        : await ctx.db
            .query('mentions')
            .withIndex('by_user_read', q => q.eq('mentionedUserId', userId).eq('read', args.read!))
            .order('desc')
            .take(limit * 2)

    const authors = new Map<string, Doc<'users'> | null>()
    const out = []
    for (const m of rows) {
      const contextDetail = await resolveContext(ctx, m, teamId)
      if (!contextDetail) continue
      if (!authors.has(m.mentionedByUserId)) authors.set(m.mentionedByUserId, await loadAuthor(ctx, m.mentionedByUserId))
      const author = authors.get(m.mentionedByUserId)
      out.push({
        ...m,
        count: m.count ?? 1,
        authorName: author ? author.name || author.email.split('@')[0] : m.mentionedByUserId.split('@')[0],
        authorAvatar: author?.avatarUrl,
        contextDetail,
      })
      if (out.length >= limit) break
    }
    return out.sort((a, b) => b.createdAt - a.createdAt)
  },
})

export const unreadCount = query({
  args: {},
  handler: async ctx => {
    const { userId, teamId } = await requireTeam(ctx)
    const unread = await ctx.db
      .query('mentions')
      .withIndex('by_user_read', q => q.eq('mentionedUserId', userId).eq('read', false))
      .collect()
    let count = 0
    for (const m of unread) {
      if (await resolveContext(ctx, m, teamId)) count++
    }
    return count
  },
})

export const markRead = mutation({
  args: { mentionId: v.id('mentions') },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx)
    const mention = await ctx.db.get(args.mentionId)
    if (!mention || mention.mentionedUserId !== userId) {
      throw authError('NOT_FOUND', 'Notification not found.')
    }
    if (!mention.read) await ctx.db.patch(args.mentionId, { read: true })
  },
})

export const markAllRead = mutation({
  args: {},
  handler: async ctx => {
    const { userId } = await requireTeam(ctx)
    const unread = await ctx.db
      .query('mentions')
      .withIndex('by_user_read', q => q.eq('mentionedUserId', userId).eq('read', false))
      .collect()

    for (const m of unread) {
      await ctx.db.patch(m._id, { read: true })
    }
  },
})
