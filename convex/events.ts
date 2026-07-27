import { MutationCtx } from './_generated/server'

export type ActivityEventInput = {
  kind: string
  refType: string
  refId: string
  payload?: any
}

const DEFAULT_TEAM = 'doko' // v1: single team

export async function appendActivityEvent(ctx: MutationCtx, event: ActivityEventInput) {
  const identity = await ctx.auth.getUserIdentity()
  const userId = identity?.subject ?? identity?.name ?? 'anonymous'

  await ctx.db.insert('activityEvents', {
    teamId: DEFAULT_TEAM,
    userId,
    kind: event.kind,
    refType: event.refType,
    refId: event.refId,
    payload: event.payload ?? {},
    ts: Date.now(),
  })
}
