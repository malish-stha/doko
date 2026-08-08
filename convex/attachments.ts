import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTeam } from './teamHelper'
import { appendActivityEvent } from './events'
import { notifyWatchers } from './watchers'
import { touchTicket } from './tickets'


export const generateUploadUrl = mutation({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireTeam(ctx, args.userEmail)
    return await ctx.storage.generateUploadUrl()
  },
})

export const record = mutation({
  args: {
    ticketId: v.id('tickets'),
    storageId: v.id('_storage'),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)

    const id = await ctx.db.insert('attachments', {
      ticketId: args.ticketId,
      storageId: args.storageId,
      filename: args.filename,
      mimeType: args.mimeType,
      size: args.size,
      uploadedBy: userId,
      uploadedAt: Date.now(),
    })

    await appendActivityEvent(
      ctx,
      {
        kind: 'ticket.attached',
        refType: 'attachment',
        refId: id,
        payload: { ticketId: args.ticketId, filename: args.filename, size: args.size },
      },
      args.userEmail,
    )

    await notifyWatchers(ctx, args.ticketId, userId, 'ticket.attached', { filename: args.filename })
    await touchTicket(ctx, args.ticketId)

    return id
  },
})

export const byTicket = query({
  args: { ticketId: v.id('tickets'), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireTeam(ctx, args.userEmail)
    const rows = await ctx.db
      .query('attachments')
      .withIndex('by_ticket', q => q.eq('ticketId', args.ticketId))
      .collect()

    return await Promise.all(
      rows.map(async r => {
        const url = await ctx.storage.getUrl(r.storageId)
        return {
          ...r,
          url,
        }
      }),
    )
  },
})

export const remove = mutation({
  args: {
    attachmentId: v.id('attachments'),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTeam(ctx, args.userEmail)
    const att = await ctx.db.get(args.attachmentId)
    if (!att) throw new Error('attachment not found')

    await ctx.db.delete(args.attachmentId)
    try {
      await ctx.storage.delete(att.storageId)
    } catch {
      // ignore if storage item already missing
    }

    await appendActivityEvent(
      ctx,
      {
        kind: 'ticket.attachment_removed',
        refType: 'attachment',
        refId: args.attachmentId,
        payload: { ticketId: att.ticketId, filename: att.filename },
      },
      args.userEmail,
    )


    await notifyWatchers(ctx, att.ticketId, userId, 'ticket.attachment_removed', { filename: att.filename })
    await touchTicket(ctx, att.ticketId)
  },
})

