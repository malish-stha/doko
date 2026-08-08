import { QueryCtx, MutationCtx } from './_generated/server'
import { Id } from './_generated/dataModel'

export async function requireTeam(ctx: QueryCtx | MutationCtx, callerEmail?: string) {
  const identity = await ctx.auth.getUserIdentity()
  const cleanEmail = (identity?.email ?? callerEmail)?.trim().toLowerCase()
  const userId = identity?.subject ?? cleanEmail

  let user = null
  if (userId) {
    user = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .first()
  }

  if (!user && cleanEmail) {
    const users = await ctx.db.query('users').collect()
    user = users.find(u => u.email.trim().toLowerCase() === cleanEmail) ?? null
  }

  let teamId = user?.teamId
  if (!teamId) {
    const firstTeam = await ctx.db.query('teams').first()
    if (firstTeam) {
      teamId = firstTeam._id
    } else if ('insert' in ctx.db) {
      teamId = await (ctx as MutationCtx).db.insert('teams', {
        slug: 'doko',
        name: 'Doko Workspace',
        ownerId: user?.userId ?? userId ?? 'dev-user',
        createdAt: Date.now(),
      })
    }
  }

  return { identity, user, userId: user?.userId ?? userId ?? 'anonymous', teamId }
}

export async function getMembership(
  ctx: QueryCtx | MutationCtx,
  teamId: Id<'teams'>,
  userId: string,
  email?: string,
) {
  const members = await ctx.db
    .query('teamMembers')
    .withIndex('by_team', q => q.eq('teamId', teamId))
    .collect()

  const cleanEmail = email?.trim().toLowerCase()
  const member = members.find(
    m => m.userId === userId || (cleanEmail && m.email.trim().toLowerCase() === cleanEmail),
  )

  // Auto-heal legacy userId mismatch in DB
  if (member && member.userId !== userId && 'db' in ctx && 'patch' in ctx.db) {
    await (ctx as MutationCtx).db.patch(member._id, { userId })
  }

  return member
}
