import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTeam, requireRole } from './teamHelper'

export const listForTeam = query({
  args: {},
  handler: async ctx => {
    const { teamId } = await requireTeam(ctx)
    const members = await ctx.db
      .query('teamMembers')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .collect()

    const users = await ctx.db.query('users').collect()
    const userMap = new Map(users.map(u => [u.userId, u]))
    const userEmailMap = new Map(users.map(u => [u.email.toLowerCase(), u]))

    return members.map(m => {
      const u = userMap.get(m.userId) ?? userEmailMap.get(m.email.toLowerCase())
      return {
        ...m,
        name: u?.name,
        avatarUrl: u?.avatarUrl,
      }
    })
  },
})

export const remove = mutation({
  args: { memberId: v.id('teamMembers') },
  handler: async (ctx, args) => {
    const { userId, email, teamId, membership: me } = await requireRole(ctx, ['owner'])

    const target = await ctx.db.get(args.memberId)
    if (!target || target.teamId !== teamId) throw new Error('Member not found')

    if (
      target._id === me._id ||
      target.userId === userId ||
      target.email.trim().toLowerCase() === email
    ) {
      throw new Error('Owner cannot remove themselves — transfer ownership first')
    }

    const targetUser = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', target.userId))
      .first()
    if (targetUser) {
      await ctx.db.patch(targetUser._id, { teamId: undefined })
    }

    await ctx.db.delete(args.memberId)
  },
})

export const leave = mutation({
  args: {},
  handler: async ctx => {
    const { user, membership: me } = await requireTeam(ctx)

    if (me.role === 'owner') {
      throw new Error('Owner cannot leave — transfer ownership first')
    }

    if (user) {
      await ctx.db.patch(user._id, { teamId: undefined })
    }

    await ctx.db.delete(me._id)
  },
})

export const changeRole = mutation({
  args: {
    memberId: v.id('teamMembers'),
    role: v.union(v.literal('admin'), v.literal('member')),
  },
  handler: async (ctx, args) => {
    const { teamId } = await requireRole(ctx, ['owner'])

    const target = await ctx.db.get(args.memberId)
    if (!target || target.teamId !== teamId) throw new Error('Member not found')
    if (target.role === 'owner') throw new Error('Cannot change owner role')

    await ctx.db.patch(args.memberId, { role: args.role })
  },
})
