import { v } from 'convex/values'
import { mutation, query, MutationCtx } from './_generated/server'
import { appendActivityEvent } from './events'
import {
  Ctx,
  assertTicketInTeam,
  authError,
  getMembership,
  isAdminRole,
  normalizeEmail,
  requireTeam,
} from './teamHelper'
import { extractMentionIds } from '../lib/mentions'
import { notifyWatchers } from './watchers'
import { touchTicket } from './tickets'
import { Doc, Id } from './_generated/dataModel'

const MAX_BODY = 10_000

async function loadAuthors(ctx: Ctx, teamId: Id<'teams'>, ids: Iterable<string>) {
  const result = new Map<string, { userId: string; name: string; email: string; avatarUrl?: string }>()
  for (const id of new Set(ids)) {
    const user =
      (await ctx.db.query('users').withIndex('by_userId', q => q.eq('userId', id)).first()) ??
      (await ctx.db.query('users').withIndex('by_email', q => q.eq('email', normalizeEmail(id))).first())
    if (user) {
      result.set(id, { userId: user.userId, name: user.name || user.email.split('@')[0], email: user.email, avatarUrl: user.avatarUrl })
      continue
    }
    const member = await getMembership(ctx, teamId, id, normalizeEmail(id))
    if (member) result.set(id, { userId: member.userId, name: member.email.split('@')[0], email: member.email })
  }
  return result
}

export const byTicket = query({
  args: { ticketId: v.id('tickets') },
  handler: async (ctx, args) => {
    const { userId, teamId, role } = await requireTeam(ctx)
    await assertTicketInTeam(ctx, args.ticketId, teamId)

    const comments = await ctx.db
      .query('comments')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .order('asc')
      .collect()

    const authors = await loadAuthors(ctx, teamId, comments.map(c => c.authorId))
    const isAdmin = isAdminRole(role)

    return comments.map(c => {
      const a = authors.get(c.authorId)
      const isMine = c.authorId === userId
      return {
        ...c,
        authorName: a?.name ?? (c.authorId.includes('@') ? c.authorId.split('@')[0] : 'Teammate'),
        authorEmail: a?.email ?? (c.authorId.includes('@') ? c.authorId : ''),
        authorUserId: a?.userId ?? c.authorId,
        avatarUrl: a?.avatarUrl,
        canEdit: isMine,
        canDelete: isMine || isAdmin,
      }
    })
  },
})

function cleanBody(body: string) {
  const trimmed = body.trim()
  if (!trimmed) throw authError('FORBIDDEN', 'Comment cannot be empty.')
  if (trimmed.length > MAX_BODY) throw authError('FORBIDDEN', `Comments are limited to ${MAX_BODY} characters.`)
  return trimmed
}

/** Creates mention rows for teammates referenced in `body`; returns the notified ids. */
async function notifyMentions(
  ctx: MutationCtx,
  teamId: Id<'teams'>,
  commentId: Id<'comments'>,
  authorId: string,
  body: string,
) {
  const notified = new Set<string>()
  const now = Date.now()
  for (const mentioned of extractMentionIds(body)) {
    const member = await getMembership(ctx, teamId, mentioned, normalizeEmail(mentioned))
    if (!member || member.userId === authorId || notified.has(member.userId)) continue
    notified.add(member.userId)
    await ctx.db.insert('mentions', {
      contextRefType: 'comment',
      contextRefId: commentId,
      mentionedUserId: member.userId,
      mentionedByUserId: authorId,
      read: false,
      createdAt: now,
    })
  }
  return notified
}

export const add = mutation({
  args: {
    ticketId: v.id('tickets'),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const body = cleanBody(args.body)
    const { userId, teamId } = await requireTeam(ctx)
    const ticket = await assertTicketInTeam(ctx, args.ticketId, teamId)

    const now = Date.now()
    const id = await ctx.db.insert('comments', {
      ticketId: args.ticketId,
      authorId: userId,
      body,
      createdAt: now,
    })

    const mentioned = await notifyMentions(ctx, teamId, id, userId, body)

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'ticket.commented',
      refType: 'comment',
      refId: id,
      ticketId: args.ticketId,
      payload: {
        ticketId: args.ticketId,
        ticketKey: ticket.key,
        bodyPreview: body.slice(0, 100),
        author: userId,
      },
    })

    // Watchers who were @mentioned already have a notification for this comment.
    await notifyWatchers(ctx, args.ticketId, userId, 'ticket.commented', { bodyPreview: body.slice(0, 100) }, mentioned)
    await touchTicket(ctx, args.ticketId)

    return id
  },
})

async function loadCommentInTeam(ctx: Ctx, commentId: Id<'comments'>, teamId: Id<'teams'>): Promise<Doc<'comments'>> {
  const comment = await ctx.db.get(commentId)
  if (!comment) throw authError('NOT_FOUND', 'Comment not found.')
  await assertTicketInTeam(ctx, comment.ticketId, teamId)
  return comment
}

/** Authors may edit their own comments. */
export const edit = mutation({
  args: { commentId: v.id('comments'), body: v.string() },
  handler: async (ctx, args) => {
    const body = cleanBody(args.body)
    const { userId, teamId } = await requireTeam(ctx)
    const comment = await loadCommentInTeam(ctx, args.commentId, teamId)
    if (comment.authorId !== userId) throw authError('FORBIDDEN', 'You can only edit your own comments.')

    await ctx.db.patch(comment._id, { body, editedAt: Date.now() })
    await notifyMentions(ctx, teamId, comment._id, userId, body)
    await touchTicket(ctx, comment.ticketId)
  },
})

/** Authors and team admins may delete a comment (and its mention rows). */
export const remove = mutation({
  args: { commentId: v.id('comments') },
  handler: async (ctx, args) => {
    const { userId, teamId, role } = await requireTeam(ctx)
    const comment = await loadCommentInTeam(ctx, args.commentId, teamId)
    if (comment.authorId !== userId && !isAdminRole(role)) {
      throw authError('FORBIDDEN', 'Only the author or a team admin can delete this comment.')
    }

    const mentions = await ctx.db
      .query('mentions')
      .withIndex('by_context', q => q.eq('contextRefType', 'comment').eq('contextRefId', comment._id))
      .collect()
    for (const m of mentions) await ctx.db.delete(m._id)
    await ctx.db.delete(comment._id)

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'ticket.comment_deleted',
      refType: 'comment',
      refId: comment._id,
      ticketId: comment.ticketId,
      payload: { ticketId: comment.ticketId },
    })
    await touchTicket(ctx, comment.ticketId)
  },
})
