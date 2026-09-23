import { v } from 'convex/values'
import { MutationCtx, query } from './_generated/server'
import { Doc, Id } from './_generated/dataModel'
import { Ctx, assertTicketInTeam, normalizeEmail, requireTeam } from './teamHelper'

export type ActivityEventInput = {
  /** Team the event belongs to. Required: there is no shared "unassigned" bucket. */
  teamId: Id<'teams'>
  /** Verified identity of the actor, taken from the calling mutation. */
  userId: string
  kind: string
  refType: string
  refId: string
  /** Ticket the event relates to, so the ticket timeline can use an index. */
  ticketId?: Id<'tickets'>
  payload?: Record<string, unknown>
}

/**
 * Appends an activity event. The caller passes the actor and team it has
 * already resolved; this helper never re-derives identity, so events can be
 * written from any context (including on behalf of a just-added member).
 */
export async function appendActivityEvent(ctx: MutationCtx, event: ActivityEventInput) {
  if (!event.teamId) throw new Error('appendActivityEvent: teamId is required')
  if (!event.userId) throw new Error('appendActivityEvent: userId is required')

  await ctx.db.insert('activityEvents', {
    teamId: event.teamId,
    userId: event.userId,
    kind: event.kind,
    refType: event.refType,
    refId: event.refId,
    ticketId: event.ticketId,
    payload: event.payload ?? {},
    ts: Date.now(),
  })
}

const MAX_PAGE_SIZE = 100

/** Resolves display info for a set of actor ids without scanning whole tables. */
async function loadActors(ctx: Ctx, teamId: Id<'teams'>, ids: Iterable<string>) {
  const result = new Map<string, { name: string; email: string; avatarUrl?: string }>()
  for (const id of new Set(ids)) {
    if (!id) continue
    const user =
      (await ctx.db.query('users').withIndex('by_userId', q => q.eq('userId', id)).first()) ??
      (await ctx.db.query('users').withIndex('by_email', q => q.eq('email', normalizeEmail(id))).first())
    if (user) {
      result.set(id, { name: user.name || user.email.split('@')[0], email: user.email, avatarUrl: user.avatarUrl })
      continue
    }
    const member = await ctx.db
      .query('teamMembers')
      .withIndex('by_team_user', q => q.eq('teamId', teamId).eq('userId', id))
      .first()
    if (member) {
      result.set(id, { name: member.email.split('@')[0], email: member.email })
    }
  }
  return result
}

export const forTicket = query({
  args: {
    ticketId: v.id('tickets'),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx)
    await assertTicketInTeam(ctx, args.ticketId, teamId)

    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(args.pageSize ?? args.limit ?? 5)))
    const page = Math.max(1, Math.floor(args.page ?? 1))

    // Newest first, straight from the index; fetch one extra page to know if more exist.
    const rows: Doc<'activityEvents'>[] = await ctx.db
      .query('activityEvents')
      .withIndex('by_ticket_ts', q => q.eq('ticketId', args.ticketId))
      .order('desc')
      .take(page * pageSize + 1)

    const hasMore = rows.length > page * pageSize
    const sliced = rows.slice((page - 1) * pageSize, page * pageSize)

    const actors = await loadActors(
      ctx,
      teamId,
      sliced.flatMap(e => {
        const alt = e.payload?.author ?? e.payload?.watcherId ?? e.payload?.assignedByEmail
        return typeof alt === 'string' ? [e.userId, alt] : [e.userId]
      }),
    )

    return {
      events: sliced.map(e => {
        const actor = actors.get(e.userId) ?? (typeof e.payload?.author === 'string' ? actors.get(e.payload.author) : undefined)
        return {
          ...e,
          userName: actor?.name ?? (e.userId.includes('@') ? e.userId.split('@')[0] : 'Teammate'),
          userEmail: actor?.email ?? (e.userId.includes('@') ? e.userId : ''),
          avatarUrl: actor?.avatarUrl,
        }
      }),
      page,
      pageSize,
      hasMore,
      // Kept for existing UI; exact totals would require a full scan.
      totalCount: (page - 1) * pageSize + sliced.length + (hasMore ? 1 : 0),
      totalPages: hasMore ? page + 1 : page,
    }
  },
})
