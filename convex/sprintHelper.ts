import { MutationCtx } from './_generated/server'
import { Id } from './_generated/dataModel'
import { Ctx, authError } from './teamHelper'

/** The team's single active sprint, or null. Throws if the invariant is broken. */
export async function activeSprintFor(ctx: Ctx, teamId: Id<'teams'>) {
  const active = await ctx.db
    .query('sprints')
    .withIndex('by_team_status', q => q.eq('teamId', teamId).eq('status', 'active'))
    .collect()
  if (active.length > 1) {
    throw authError('FORBIDDEN', 'More than one sprint is active; complete one first.')
  }
  return active[0] ?? null
}

/** Sum of story points for a sprint's tickets. */
export async function sumStoryPoints(ctx: Ctx, sprintId: Id<'sprints'>) {
  const tickets = await ctx.db
    .query('tickets')
    .withIndex('by_sprint', q => q.eq('sprintId', sprintId))
    .collect()
  return tickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
}

/**
 * Keeps plannedPoints accurate for an active sprint after tickets move in or
 * out or change their estimate. No-op for planning/completed sprints.
 */
export async function recomputePlannedPoints(ctx: MutationCtx, sprintId: Id<'sprints'> | undefined) {
  if (!sprintId) return
  const sprint = await ctx.db.get(sprintId)
  if (!sprint || sprint.status !== 'active') return
  const plannedPoints = await sumStoryPoints(ctx, sprintId)
  if (sprint.plannedPoints !== plannedPoints) {
    await ctx.db.patch(sprintId, { plannedPoints })
  }
}
