import type { TestConvex } from 'convex-test'
import type schema from './schema'
import type { Id } from './_generated/dataModel'

/**
 * Shared fixtures for convex-test suites. Type-only imports keep this file
 * inert if the Convex bundler picks it up.
 */

export type TestIdentity = { subject: string; email?: string; name?: string }

export type Harness = TestConvex<typeof schema>

/** Adds `identity` to `teamId` directly, bypassing the invite flow. */
export async function joinTeam(t: Harness, teamId: Id<'teams'>, identity: TestIdentity, role: 'admin' | 'member' = 'member') {
  const email = (identity.email ?? identity.subject).toLowerCase()
  await t.run(async ctx => {
    await ctx.db.insert('teamMembers', {
      teamId,
      userId: identity.subject,
      email,
      role,
      joinedAt: Date.now(),
    })
    const existing = await ctx.db
      .query('users')
      .withIndex('by_userId', q => q.eq('userId', identity.subject))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { teamId })
    } else {
      await ctx.db.insert('users', {
        userId: identity.subject,
        email,
        name: identity.name ?? email,
        timezone: 'UTC',
        teamId,
        createdAt: Date.now(),
      })
    }
  })
}
