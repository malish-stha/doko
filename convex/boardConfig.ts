import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Ctx, authError, requireRole, requireTeam } from './teamHelper'
import { Doc, Id } from './_generated/dataModel'

export const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const
export type Status = (typeof STATUSES)[number]

const STATUS = v.union(
  v.literal('backlog'),
  v.literal('todo'),
  v.literal('in_progress'),
  v.literal('review'),
  v.literal('done'),
)

const wipLimitsValidator = v.object({
  backlog: v.optional(v.number()),
  todo: v.optional(v.number()),
  in_progress: v.optional(v.number()),
  review: v.optional(v.number()),
  done: v.optional(v.number()),
})

const columnLabelsValidator = v.object({
  backlog: v.optional(v.string()),
  todo: v.optional(v.string()),
  in_progress: v.optional(v.string()),
  review: v.optional(v.string()),
  done: v.optional(v.string()),
})

export const DEFAULT_COLUMNS: Status[] = [...STATUSES]

/** One row per team; `.unique()` enforces the invariant loudly if it breaks. */
export async function boardConfigFor(ctx: Ctx, teamId: Id<'teams'>): Promise<Doc<'boardConfig'> | null> {
  return await ctx.db
    .query('boardConfig')
    .withIndex('by_team', q => q.eq('teamId', teamId))
    .unique()
}

/**
 * Throws when moving one more ticket into `status` would exceed the team's
 * WIP limit. `currentCount` is the number of tickets already in the column
 * (excluding the one being moved).
 */
export function assertWithinWipLimit(config: Doc<'boardConfig'> | null, status: Status, currentCount: number) {
  const limit = config?.wipLimits?.[status]
  if (limit !== undefined && limit > 0 && currentCount + 1 > limit) {
    throw authError(
      'FORBIDDEN',
      `${status.replace('_', ' ')} is at its WIP limit of ${limit}. Move something out first.`,
    )
  }
}

export const forMyTeam = query({
  args: {},
  handler: async ctx => {
    const { teamId } = await requireTeam(ctx)
    return await boardConfigFor(ctx, teamId)
  },
})

/** Owners and admins configure the team board. */
export const upsert = mutation({
  args: {
    wipLimits: v.optional(wipLimitsValidator),
    visibleColumns: v.optional(v.array(STATUS)),
    columnLabels: v.optional(columnLabelsValidator),
  },
  handler: async (ctx, args) => {
    const { teamId, userId } = await requireRole(ctx, ['owner', 'admin'])

    if (args.wipLimits) {
      for (const [status, limit] of Object.entries(args.wipLimits)) {
        if (limit !== undefined && (!Number.isInteger(limit) || limit < 0 || limit > 999)) {
          throw authError('FORBIDDEN', `WIP limit for ${status} must be a whole number between 0 and 999.`)
        }
      }
    }
    if (args.visibleColumns) {
      if (args.visibleColumns.length === 0) throw authError('FORBIDDEN', 'At least one column must be visible.')
      if (new Set(args.visibleColumns).size !== args.visibleColumns.length) {
        throw authError('FORBIDDEN', 'Columns cannot be listed twice.')
      }
    }
    const cleanLabels = args.columnLabels
      ? Object.fromEntries(
          Object.entries(args.columnLabels).map(([k, label]) => [k, label?.trim().slice(0, 40) || undefined]),
        )
      : undefined

    const existing = await boardConfigFor(ctx, teamId)
    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        wipLimits: args.wipLimits ?? existing.wipLimits,
        visibleColumns: args.visibleColumns ?? existing.visibleColumns,
        columnLabels: cleanLabels ?? existing.columnLabels,
        updatedAt: now,
        updatedBy: userId,
      })
      return existing._id
    }

    return await ctx.db.insert('boardConfig', {
      teamId,
      wipLimits: args.wipLimits ?? {},
      visibleColumns: args.visibleColumns ?? DEFAULT_COLUMNS,
      columnLabels: cleanLabels ?? {},
      updatedAt: now,
      updatedBy: userId,
    })
  },
})
