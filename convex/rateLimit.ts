import { v, ConvexError } from 'convex/values'
import { internalMutation, MutationCtx } from './_generated/server'

// Rate limit configuration constants
export const RATE_LIMIT_CONFIG = {
  COOLDOWN_MS: 3 * 60 * 1000, // 3 minutes cooldown between generations
  HOURLY_LIMIT: 2, // Max 2 generations per hour
  DAILY_LIMIT: 5, // Max 5 generations per 24 hours
}

const ONE_HOUR = 60 * 60 * 1000
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

function formatWait(ms: number) {
  const remainingSec = Math.max(1, Math.ceil(ms / 1000))
  const mins = Math.floor(remainingSec / 60)
  const secs = remainingSec % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

async function loadRecord(ctx: MutationCtx, userId: string, actionType: string) {
  return await ctx.db
    .query('aiRateLimits')
    .withIndex('by_user_action', q => q.eq('userId', userId).eq('actionType', actionType))
    .first()
}

/**
 * Evaluates every limit against the caller's history (an absent record is an
 * empty history, so first calls go through the same checks). Throws a
 * ConvexError with a user-facing message when a limit is hit. Does not
 * consume quota: call `record` after the expensive work succeeded.
 */
export const check = internalMutation({
  args: { userId: v.string(), actionType: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now()
    const { COOLDOWN_MS, HOURLY_LIMIT, DAILY_LIMIT } = RATE_LIMIT_CONFIG
    const record = await loadRecord(ctx, args.userId, args.actionType)
    const history = (record?.callHistory ?? []).filter(ts => now - ts < TWENTY_FOUR_HOURS)
    const lastCalledAt = record?.lastCalledAt ?? (history.length ? Math.max(...history) : undefined)

    if (lastCalledAt !== undefined && now - lastCalledAt < COOLDOWN_MS) {
      throw new ConvexError(
        `AI Rate Limit: Please wait ${formatWait(COOLDOWN_MS - (now - lastCalledAt))} before generating another Morning Brief.`,
      )
    }

    const inPastHour = history.filter(ts => now - ts < ONE_HOUR)
    if (inPastHour.length >= HOURLY_LIMIT) {
      const oldest = Math.min(...inPastHour) // history is not guaranteed sorted
      const mins = Math.max(1, Math.ceil((ONE_HOUR - (now - oldest)) / 60000))
      throw new ConvexError(
        `AI Rate Limit Exceeded: Maximum ${HOURLY_LIMIT} AI generations per hour. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
      )
    }

    if (history.length >= DAILY_LIMIT) {
      const oldest = Math.min(...history)
      const hours = Math.max(1, Math.ceil((TWENTY_FOUR_HOURS - (now - oldest)) / ONE_HOUR))
      throw new ConvexError(
        `AI Rate Limit Exceeded: Daily limit of ${DAILY_LIMIT} AI generations reached. Resets in ~${hours} hour${hours === 1 ? '' : 's'}.`,
      )
    }
  },
})

/** Consumes one unit of quota. Call only after the generation was stored. */
export const record = internalMutation({
  args: { userId: v.string(), actionType: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await loadRecord(ctx, args.userId, args.actionType)
    const history = (existing?.callHistory ?? []).filter(ts => now - ts < TWENTY_FOUR_HOURS)
    history.push(now)
    if (existing) {
      await ctx.db.patch(existing._id, { lastCalledAt: now, callHistory: history })
    } else {
      await ctx.db.insert('aiRateLimits', {
        userId: args.userId,
        actionType: args.actionType,
        lastCalledAt: now,
        callHistory: history,
      })
    }
  },
})
