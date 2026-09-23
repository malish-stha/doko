import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertTicketInTeam, authError, isAdminRole, requireTeam } from './teamHelper'
import { appendActivityEvent } from './events'
import { notifyWatchers } from './watchers'
import { touchTicket } from './tickets'
import { Id } from './_generated/dataModel'

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

/** Content types we are willing to serve back to teammates. */
export const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/']
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
])

/** HTML/SVG/scripts are rejected: served from storage they would run as stored XSS. */
export function isAllowedMime(mimeType: string) {
  const type = mimeType.toLowerCase().split(';')[0].trim()
  if (type === 'image/svg+xml' || type === 'text/html' || type.includes('javascript') || type.includes('xml')) {
    return false
  }
  return ALLOWED_MIME_TYPES.has(type) || ALLOWED_MIME_PREFIXES.some(p => type.startsWith(p))
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async ctx => {
    await requireTeam(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

type RecordResult =
  | { ok: true; attachmentId: Id<'attachments'> }
  | { ok: false; error: string }

/**
 * Records an uploaded blob against a ticket. Size (and content type when
 * storage recorded it) come from the `_storage` system table, not the
 * client. Validation failures return `{ ok: false }` rather than throwing so
 * the blob deletion is committed and an invalid upload leaves nothing behind.
 */
export const record = mutation({
  args: {
    ticketId: v.id('tickets'),
    storageId: v.id('_storage'),
    filename: v.string(),
    mimeType: v.optional(v.string()),
    size: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<RecordResult> => {
    const { userId, teamId } = await requireTeam(ctx)
    await assertTicketInTeam(ctx, args.ticketId, teamId)

    const meta = await ctx.db.system.get(args.storageId)
    if (!meta) throw authError('NOT_FOUND', 'Upload not found. Please try again.')

    const reject = async (error: string): Promise<RecordResult> => {
      try {
        await ctx.storage.delete(args.storageId)
      } catch {
        // nothing to clean up
      }
      return { ok: false, error }
    }

    const mimeType = (meta.contentType ?? args.mimeType ?? 'application/octet-stream').toLowerCase()
    if (meta.size > MAX_ATTACHMENT_BYTES) {
      return await reject(`Attachments are limited to ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB.`)
    }
    if (!isAllowedMime(mimeType)) {
      return await reject(`Files of type ${mimeType} cannot be attached.`)
    }

    const duplicate = await ctx.db
      .query('attachments')
      .withIndex('by_storage', q => q.eq('storageId', args.storageId))
      .first()
    if (duplicate) return { ok: false, error: 'This upload has already been attached.' }

    const filename = args.filename.trim().slice(0, 255) || 'attachment'
    const id = await ctx.db.insert('attachments', {
      ticketId: args.ticketId,
      storageId: args.storageId,
      filename,
      mimeType,
      size: meta.size,
      uploadedBy: userId,
      uploadedAt: Date.now(),
    })

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'ticket.attached',
      refType: 'attachment',
      refId: id,
      ticketId: args.ticketId,
      payload: { ticketId: args.ticketId, filename, size: meta.size },
    })

    await notifyWatchers(ctx, args.ticketId, userId, 'ticket.attached', { filename })
    await touchTicket(ctx, args.ticketId)

    return { ok: true, attachmentId: id }
  },
})

export const byTicket = query({
  args: { ticketId: v.id('tickets') },
  handler: async (ctx, args) => {
    const { userId, teamId, role } = await requireTeam(ctx)
    await assertTicketInTeam(ctx, args.ticketId, teamId)
    const rows = await ctx.db
      .query('attachments')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .collect()

    const isAdmin = isAdminRole(role)
    return await Promise.all(
      rows.map(async r => ({
        ...r,
        url: await ctx.storage.getUrl(r.storageId),
        canDelete: isAdmin || r.uploadedBy === userId,
      })),
    )
  },
})

/** Uploader or a team admin may delete; the blob goes with the row. */
export const remove = mutation({
  args: { attachmentId: v.id('attachments') },
  handler: async (ctx, args) => {
    const { userId, teamId, role } = await requireTeam(ctx)
    const att = await ctx.db.get(args.attachmentId)
    if (!att) throw authError('NOT_FOUND', 'Attachment not found.')
    await assertTicketInTeam(ctx, att.ticketId, teamId)
    if (att.uploadedBy !== userId && !isAdminRole(role)) {
      throw authError('FORBIDDEN', 'Only the uploader or a team admin can delete this attachment.')
    }

    await ctx.db.delete(args.attachmentId)
    try {
      await ctx.storage.delete(att.storageId)
    } catch {
      // ignore if storage item already missing
    }

    await appendActivityEvent(ctx, {
      teamId,
      userId,
      kind: 'ticket.attachment_removed',
      refType: 'attachment',
      refId: args.attachmentId,
      ticketId: att.ticketId,
      payload: { ticketId: att.ticketId, filename: att.filename },
    })

    await notifyWatchers(ctx, att.ticketId, userId, 'ticket.attachment_removed', { filename: att.filename })
    await touchTicket(ctx, att.ticketId)
  },
})
