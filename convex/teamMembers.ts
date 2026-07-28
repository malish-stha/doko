import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTeam, getMembership } from './teamHelper'

export const listForTeam = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { teamId } = await requireTeam(ctx, args.userEmail)
    if (!teamId) return []
    return await ctx.db
      .query('teamMembers')
      .withIndex('by_team', q => q.eq('teamId', teamId))
      .collect()
  },
})

export const remove = mutation({
  args: { memberId: v.id('teamMembers'), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId, user, teamId, identity } = await requireTeam(ctx, args.userEmail)
    if (!teamId) throw new Error('No team')

    const target = await ctx.db.get(args.memberId)
    if (!target || target.teamId !== teamId) throw new Error('Member not found')

    const email = identity?.email ?? user?.email ?? args.userEmail
    const me = await getMembership(ctx, teamId, userId, email)

    if (me?.role !== 'owner') throw new Error('Only owner can remove members')
    if (target.userId === userId || (email && target.email === email.trim().toLowerCase())) {
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
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId, user, teamId, identity } = await requireTeam(ctx, args.userEmail)
    if (!teamId) throw new Error('No team')

    const email = identity?.email ?? user?.email ?? args.userEmail
    const me = await getMembership(ctx, teamId, userId, email)

    if (!me) throw new Error('Not on this team')
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
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user, teamId, identity } = await requireTeam(ctx, args.userEmail)
    if (!teamId) throw new Error('No team')

    const email = identity?.email ?? user?.email ?? args.userEmail
    const me = await getMembership(ctx, teamId, userId, email)

    if (me?.role !== 'owner') throw new Error('Only owner can change roles')

    const target = await ctx.db.get(args.memberId)
    if (!target || target.teamId !== teamId) throw new Error('Member not found')
    if (target.role === 'owner') throw new Error('Cannot change owner role')

    await ctx.db.patch(args.memberId, { role: args.role })
  },
})
