import { MutationCtx } from './_generated/server'

export type ActivityEventInput = {
  kind: string
  refType: string
  refId: string
  payload?: any
}

// Stub — real implementation in P3.2 writes to activityEvents table
export async function appendActivityEvent(_ctx: MutationCtx, _event: ActivityEventInput) {
  // no-op for now
}
