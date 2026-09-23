import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { authError, requireTeam } from './teamHelper'

const SCOPE = v.union(v.literal('board'), v.literal('list'))
const MAX_PER_USER = 50
const MAX_NAME = 60
const MAX_QUERY = 2000

function cleanName(raw: string) {
  const name = raw.trim()
  if (!name) throw authError('FORBIDDEN', 'Give the view a name.')
  return name.slice(0, MAX_NAME)
}

function cleanQuery(raw: string) {
  const qs = raw.trim().replace(/^\?/, '')
  if (qs.length > MAX_QUERY) throw authError('FORBIDDEN', 'That filter is too long to save.')
  return qs
}

/** Personal views for this team plus the team's shared views. */
export const myFilters = query({
  args: { scope: SCOPE },
  handler: async (ctx, args) => {
    const { teamId, userId } = await requireTeam(ctx)

    const userFilters = (
      await ctx.db
        .query('savedFilters')
        .withIndex('by_user_scope', q => q.eq('userId', userId).eq('scope', args.scope))
        .collect()
    ).filter(f => f.teamId === teamId)

    const sharedFilters = await ctx.db
      .query('savedFilters')
      .withIndex('by_team_scope_shared', q => q.eq('teamId', teamId).eq('scope', args.scope).eq('isShared', true))
      .collect()

    const map = new Map<string, (typeof userFilters)[0]>()
    for (const f of userFilters) map.set(f._id, f)
    for (const f of sharedFilters) map.set(f._id, f)

    return Array.from(map.values())
      .map(f => ({ ...f, isMine: f.userId === userId }))
      .sort((a, b) => b.createdAt - a.createdAt)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    scope: SCOPE,
    queryString: v.string(),
    isShared: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { teamId, userId } = await requireTeam(ctx)
    const name = cleanName(args.name)

    const mine = await ctx.db
      .query('savedFilters')
      .withIndex('by_user_scope', q => q.eq('userId', userId).eq('scope', args.scope))
      .collect()
    if (mine.filter(f => f.teamId === teamId).length >= MAX_PER_USER) {
      throw authError('FORBIDDEN', `You can keep up to ${MAX_PER_USER} saved views per team.`)
    }

    return await ctx.db.insert('savedFilters', {
      teamId,
      userId,
      name,
      scope: args.scope,
      queryString: cleanQuery(args.queryString),
      isShared: args.isShared,
      createdAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('savedFilters'),
    name: v.optional(v.string()),
    queryString: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { teamId, userId } = await requireTeam(ctx)
    const filter = await ctx.db.get(args.id)
    if (!filter || filter.teamId !== teamId) throw authError('NOT_FOUND', 'Saved view not found.')
    if (filter.userId !== userId) throw authError('FORBIDDEN', 'Only the owner can edit this view.')

    await ctx.db.patch(args.id, {
      ...(args.name !== undefined ? { name: cleanName(args.name) } : {}),
      ...(args.queryString !== undefined ? { queryString: cleanQuery(args.queryString) } : {}),
    })
  },
})

export const remove = mutation({
  args: { id: v.id('savedFilters') },
  handler: async (ctx, args) => {
    const { teamId, userId } = await requireTeam(ctx)
    const filter = await ctx.db.get(args.id)
    if (!filter || filter.teamId !== teamId) return
    if (filter.userId !== userId) throw authError('FORBIDDEN', 'Only the owner can delete this view.')
    await ctx.db.delete(args.id)
  },
})

export const share = mutation({
  args: { id: v.id('savedFilters'), isShared: v.boolean() },
  handler: async (ctx, args) => {
    const { teamId, userId } = await requireTeam(ctx)
    const filter = await ctx.db.get(args.id)
    if (!filter || filter.teamId !== teamId) throw authError('NOT_FOUND', 'Saved view not found.')
    if (filter.userId !== userId) throw authError('FORBIDDEN', 'Only the owner can change sharing.')
    await ctx.db.patch(args.id, { isShared: args.isShared })
  },
})
