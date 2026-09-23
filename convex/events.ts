import { v } from 'convex/values'
import { MutationCtx, query } from './_generated/server'
import { Id } from './_generated/dataModel'
import { requireTeam } from './teamHelper'

export type ActivityEventInput = {
  /** Team the event belongs to. Required: there is no shared "unassigned" bucket. */
  teamId: Id<'teams'> | string
  /** Verified identity of the actor, taken from the calling mutation. */
  userId: string
  kind: string
  refType: string
  refId: string
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
    teamId: event.teamId as string,
    userId: event.userId,
    kind: event.kind,
    refType: event.refType,
    refId: event.refId,
    payload: event.payload ?? {},
    ts: Date.now(),
  })
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

    let events = await ctx.db
      .query('activityEvents')
      .withIndex('by_team_ts', q => q.eq('teamId', teamId))
      .order('desc')
      .collect()

    // Filter events related to this ticket
    events = events.filter(
      e =>
        (e.refType === 'ticket' && e.refId === args.ticketId) ||
        (e.payload && e.payload.ticketId === args.ticketId) ||
        (e.payload && e.payload.sourceId === args.ticketId) ||
        (e.payload && e.payload.targetId === args.ticketId),
    )

    const totalCount = events.length
    const pageSize = args.pageSize ?? args.limit ?? 5
    const page = Math.max(1, args.page ?? 1)
    const startIndex = (page - 1) * pageSize
    const sliced = events.slice(startIndex, startIndex + pageSize)
    const totalPages = Math.ceil(totalCount / pageSize) || 1

    const users = await ctx.db.query('users').collect()
    const members = await ctx.db.query('teamMembers').collect()
    const userMap = new Map(users.map(u => [u.userId, u]))
    const userEmailMap = new Map(users.map(u => [u.email.toLowerCase(), u]))
    const memberMap = new Map(members.map(m => [m.userId, m]))
    const memberEmailMap = new Map(members.map(m => [m.email.toLowerCase(), m]))

    return {
      events: sliced.map(e => {
        let u =
          userMap.get(e.userId) ??
          userEmailMap.get(e.userId.toLowerCase()) ??
          memberMap.get(e.userId) ??
          memberEmailMap.get(e.userId.toLowerCase())

        if (!u && e.payload) {
          const alt = e.payload.author || e.payload.watcherId || e.payload.assignedByEmail
          if (typeof alt === 'string') {
            u =
              userMap.get(alt) ??
              userEmailMap.get(alt.toLowerCase()) ??
              memberMap.get(alt) ??
              memberEmailMap.get(alt.toLowerCase())
          }
        }

        let userName = 'Teammate'
        if (u) {
          userName = 'name' in u && u.name ? u.name : u.email.split('@')[0]
        } else if (e.userId && e.userId !== 'anonymous') {
          userName = e.userId.includes('@') ? e.userId.split('@')[0] : e.userId
        }

        return {
          ...e,
          userName,
          userEmail: u ? u.email : e.userId.includes('@') ? e.userId : '',
          avatarUrl: u && 'avatarUrl' in u ? u.avatarUrl : undefined,
        }
      }),
      totalCount,
      totalPages,
      page,
      pageSize,
      hasMore: page < totalPages,
    }
  },
})
