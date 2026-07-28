import { v, ConvexError } from 'convex/values'
import { internalMutation } from './_generated/server'

// Rate limit configuration constants
export const RATE_LIMIT_CONFIG = {
  COOLDOWN_MS: 3 * 60 * 1000, // 3 minutes cooldown between generations
  HOURLY_LIMIT: 2, // Max 2 generations per hour
  DAILY_LIMIT: 5, // Max 5 generations per 24 hours
}

export const checkAndRecord = internalMutation({
  args: {
    userId: v.string(),
    actionType: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const { COOLDOWN_MS, HOURLY_LIMIT, DAILY_LIMIT } = RATE_LIMIT_CONFIG
    const ONE_HOUR = 60 * 60 * 1000
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

    const record = await ctx.db
      .query('aiRateLimits')
      .withIndex('by_user_action', q =>
        q.eq('userId', args.userId).eq('actionType', args.actionType),
      )
      .first()

    if (record) {
      // 1. Check Cooldown (3 mins)
      const timeSinceLast = now - record.lastCalledAt
      if (timeSinceLast < COOLDOWN_MS) {
        const remainingSec = Math.ceil((COOLDOWN_MS - timeSinceLast) / 1000)
        const mins = Math.floor(remainingSec / 60)
        const secs = remainingSec % 60
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
        throw new ConvexError(
          `AI Rate Limit: Please wait ${timeStr} before generating another Morning Brief.`,
        )
      }

      // Filter history for past 24 hours
      const recentCalls = (record.callHistory ?? []).filter(
        ts => now - ts < TWENTY_FOUR_HOURS,
      )

      // 2. Check Hourly Limit (Max 2 per hour)
      const callsInPastHour = recentCalls.filter(ts => now - ts < ONE_HOUR)
      if (callsInPastHour.length >= HOURLY_LIMIT) {
        const oldestInHour = callsInPastHour[0]
        const resetSec = Math.ceil((ONE_HOUR - (now - oldestInHour)) / 1000)
        const mins = Math.ceil(resetSec / 60)
        throw new ConvexError(
          `AI Rate Limit Exceeded: Maximum ${HOURLY_LIMIT} AI generations per hour. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
        )
      }

      // 3. Check Daily Limit (Max 5 per 24 hours)
      if (recentCalls.length >= DAILY_LIMIT) {
        const oldestInDay = recentCalls[0]
        const resetHours = Math.ceil(
          (TWENTY_FOUR_HOURS - (now - oldestInDay)) / (1000 * 60 * 60),
        )
        throw new ConvexError(
          `AI Rate Limit Exceeded: Daily limit of ${DAILY_LIMIT} AI generations reached. Resets in ~${resetHours} hour${resetHours === 1 ? '' : 's'}.`,
        )
      }

      // Record call
      recentCalls.push(now)
      await ctx.db.patch(record._id, {
        lastCalledAt: now,
        callHistory: recentCalls,
      })
    } else {
      // First call for this user
      await ctx.db.insert('aiRateLimits', {
        userId: args.userId,
        actionType: args.actionType,
        lastCalledAt: now,
        callHistory: [now],
      })
    }
  },
})
