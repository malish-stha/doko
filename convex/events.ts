import { MutationCtx } from './_generated/server'
import { requireTeam } from './teamHelper'

export type ActivityEventInput = {
  kind: string
  refType: string
  refId: string
  payload?: any
}

export async function appendActivityEvent(ctx: MutationCtx, event: ActivityEventInput) {
  const { userId, teamId } = await requireTeam(ctx)

  await ctx.db.insert('activityEvents', {
    teamId: teamId ?? 'unassigned',
    userId,
    kind: event.kind,
    refType: event.refType,
    refId: event.refId,
    payload: event.payload ?? {},
    ts: Date.now(),
  })
}
