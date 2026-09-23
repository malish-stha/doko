import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Ctx, authError, getMembership, isAdminRole, normalizeEmail, requireTeam } from './teamHelper'
import { assertChannelAccess } from './channels'
import { appendActivityEvent } from './events'
import { extractMentionIds } from '../lib/mentions'
import { Doc } from './_generated/dataModel'

const MAX_BODY = 4000
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/** Resolves author rows for a set of ids in one pass (by userId, then by email). */
async function loadAuthors(ctx: Ctx, authorIds: Iterable<string>) {
  const byId = new Map<string, Doc<'users'>>()
  for (const id of new Set(authorIds)) {
    const direct = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', id))
      .first()
    const user =
      direct ??
      (await ctx.db
        .query('users')
        .withIndex('by_email', q => q.eq('email', normalizeEmail(id)))
        .first())
    if (user) byId.set(id, user)
  }
  return byId
}

function enrich(
  m: Doc<'messages'>,
  authors: Map<string, Doc<'users'>>,
  viewer: { userId: string; isAdmin: boolean },
) {
  const u = authors.get(m.authorId)
  const isMine = m.authorId === viewer.userId
  return {
    ...m,
    avatarUrl: u?.avatarUrl,
    authorEmail: u?.email,
    authorName: u?.name ?? m.authorId,
    canEdit: isMine,
    canDelete: isMine || viewer.isAdmin,
  }
}

export const byChannel = query({
  args: { channelId: v.id('channels'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId, teamId, role } = await requireTeam(ctx)
    await assertChannelAccess(ctx, args.channelId, teamId, userId)

    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(args.limit ?? DEFAULT_LIMIT)))
    const msgs = await ctx.db
      .query('messages')
      .withIndex('by_channel_created', q => q.eq('channelId', args.channelId))
      .order('desc')
      .take(limit)

    const authors = await loadAuthors(ctx, msgs.map(m => m.authorId))
    const viewer = { userId, isAdmin: isAdminRole(role) }
    return msgs.map(m => enrich(m, authors, viewer)).reverse()
  },
})

export const threadReplies = query({
  args: { rootId: v.id('messages') },
  handler: async (ctx, args) => {
    const { userId, teamId, role } = await requireTeam(ctx)
    const root = await ctx.db.get(args.rootId)
    if (!root) return []
    await assertChannelAccess(ctx, root.channelId, teamId, userId)

    const msgs = await ctx.db
      .query('messages')
      .withIndex('by_thread', q => q.eq('threadRootId', args.rootId))
      .order('asc')
      .collect()

    const authors = await loadAuthors(ctx, msgs.map(m => m.authorId))
    const viewer = { userId, isAdmin: isAdminRole(role) }
    return msgs.map(m => enrich(m, authors, viewer))
  },
})

function cleanBody(body: string) {
  const trimmed = body.trim()
  if (!trimmed) throw authError('FORBIDDEN', 'Message cannot be empty.')
  if (trimmed.length > MAX_BODY) {
    throw authError('FORBIDDEN', `Messages are limited to ${MAX_BODY} characters.`)
  }
  return trimmed
}

export const send = mutation({
  args: {
    channelId: v.id('channels'),
    body: v.string(),
    threadRootId: v.optional(v.id('messages')),
  },
  handler: async (ctx, args) => {
    const body = cleanBody(args.body)
    const { userId, teamId } = await requireTeam(ctx)
    const channel = await assertChannelAccess(ctx, args.channelId, teamId, userId)

    if (args.threadRootId) {
      const root = await ctx.db.get(args.threadRootId)
      if (!root || root.channelId !== channel._id) {
        throw authError('NOT_FOUND', 'Thread not found in this channel.')
      }
      if (root.threadRootId) {
        throw authError('FORBIDDEN', 'Replies can only be added to a top-level message.')
      }
    }

    const now = Date.now()
    const id = await ctx.db.insert('messages', {
      channelId: channel._id,
      authorId: userId,
      body,
      threadRootId: args.threadRootId,
      createdAt: now,
    })

    // @mentions notify teammates only; unknown ids are ignored.
    for (const mentioned of extractMentionIds(body)) {
      const member = await getMembership(ctx, teamId, mentioned, normalizeEmail(mentioned))
      if (!member || member.userId === userId) continue
      await ctx.db.insert('mentions', {
        contextRefType: 'message',
        contextRefId: id,
        mentionedUserId: member.userId,
        mentionedByUserId: userId,
        read: false,
        createdAt: now,
      })
    }

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'message.posted',
      refType: 'message',
      refId: id,
      payload: {
        channelId: channel._id,
        bodyPreview: body.slice(0, 100),
        thread: Boolean(args.threadRootId),
      },
    })

    return id
  },
})

/** Authors may edit their own messages. */
export const edit = mutation({
  args: { messageId: v.id('messages'), body: v.string() },
  handler: async (ctx, args) => {
    const body = cleanBody(args.body)
    const { userId, teamId } = await requireTeam(ctx)
    const message = await ctx.db.get(args.messageId)
    if (!message) throw authError('NOT_FOUND', 'Message not found.')
    await assertChannelAccess(ctx, message.channelId, teamId, userId)
    if (message.authorId !== userId) {
      throw authError('FORBIDDEN', 'You can only edit your own messages.')
    }
    await ctx.db.patch(message._id, { body, editedAt: Date.now() })
  },
})

/** Authors and team admins may delete a message (and its reactions). */
export const remove = mutation({
  args: { messageId: v.id('messages') },
  handler: async (ctx, args) => {
    const { userId, teamId, role } = await requireTeam(ctx)
    const message = await ctx.db.get(args.messageId)
    if (!message) throw authError('NOT_FOUND', 'Message not found.')
    await assertChannelAccess(ctx, message.channelId, teamId, userId)
    if (message.authorId !== userId && !isAdminRole(role)) {
      throw authError('FORBIDDEN', 'Only the author or a team admin can delete this message.')
    }

    const reactions = await ctx.db
      .query('reactions')
      .withIndex('by_message', q => q.eq('messageId', message._id))
      .collect()
    for (const r of reactions) await ctx.db.delete(r._id)
    await ctx.db.delete(message._id)

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'message.deleted',
      refType: 'message',
      refId: message._id,
      payload: { channelId: message.channelId },
    })
  },
})
