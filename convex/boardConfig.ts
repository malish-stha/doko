import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTeam } from './teamHelper'

export const forMyTeam = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) return null
    return await ctx.db
      .query('boardConfig')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .first()
  },
})

export const upsert = mutation({
  args: {
    wipLimits: v.optional(
      v.object({
        backlog: v.optional(v.number()),
        todo: v.optional(v.number()),
        in_progress: v.optional(v.number()),
        review: v.optional(v.number()),
        done: v.optional(v.number()),
      }),
    ),
    visibleColumns: v.optional(v.array(v.string())),
    columnLabels: v.optional(v.any()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { teamId, userId, identity } = await requireTeam(ctx, args.userEmail)
    if (!teamId) throw new Error('No active team found')

    const existing = await ctx.db
      .query('boardConfig')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .first()

    const updater = identity?.email ?? userId

    const defaultColumns = ['backlog', 'todo', 'in_progress', 'review', 'done']

    if (existing) {
      await ctx.db.patch(existing._id, {
        wipLimits: args.wipLimits !== undefined ? args.wipLimits : existing.wipLimits,
        visibleColumns: args.visibleColumns !== undefined ? args.visibleColumns : existing.visibleColumns,
        columnLabels: args.columnLabels !== undefined ? args.columnLabels : existing.columnLabels,
        updatedAt: Date.now(),
        updatedBy: updater,
      })
      return existing._id
    } else {
      const newId = await ctx.db.insert('boardConfig', {
        teamId,
        wipLimits: args.wipLimits ?? {},
        visibleColumns: args.visibleColumns ?? defaultColumns,
        columnLabels: args.columnLabels ?? {},
        updatedAt: Date.now(),
        updatedBy: updater,
      })
      return newId
    }
  },
})
