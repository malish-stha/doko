import { internalMutation } from './_generated/server'

export const backfillChannelKind = internalMutation({
  args: {},
  handler: async (ctx) => {
    const chans = await ctx.db.query('channels').collect()
    let patched = 0
    for (const c of chans) {
      if ((c as any).kind) continue
      await ctx.db.patch(c._id, { kind: c.isPrivate ? 'private' : 'public' })
      patched++
    }
    return { patched, total: chans.length }
  },
})
