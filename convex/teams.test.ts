import { describe, test, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

describe('Multi-Team Data Isolation', () => {
  test('tickets from Team Alpha are completely invisible to Team Beta users', async () => {
    const t = convexTest(schema)

    // User A creates Team Alpha
    const userA = t.withIdentity({ subject: 'user-a', email: 'usera@alpha.com' })
    const teamAlphaId = await userA.mutation(api.teams.create, { name: 'Team Alpha' })

    // User A creates a ticket in Team Alpha
    const ticketKey = await userA.mutation(api.tickets.create, {
      projectId: 'alpha',
      type: 'feature',
      title: 'Secret Alpha Feature',
      priority: 'high',
    })

    // User B creates Team Beta
    const userB = t.withIdentity({ subject: 'user-b', email: 'userb@beta.com' })
    const teamBetaId = await userB.mutation(api.teams.create, { name: 'Team Beta' })

    // User B queries tickets
    const betaTickets = await userB.query(api.tickets.list, { projectId: 'alpha' })

    // Assert User B sees ZERO tickets from Team Alpha
    expect(betaTickets).toHaveLength(0)
    expect(teamAlphaId).not.toBe(teamBetaId)
  })
})

describe('Multiple teams per user', () => {
  test('a user can own two teams, switch between them, and each team keeps its own data', async () => {
    const t = convexTest(schema)
    const me = t.withIdentity({ subject: 'owner@example.com', email: 'owner@example.com' })

    const alphaId = await me.mutation(api.teams.create, { name: 'Alpha' })
    await me.mutation(api.tickets.create, { projectId: 'doko', type: 'task', title: 'Alpha task' })

    const betaId = await me.mutation(api.teams.create, { name: 'Beta' })
    expect(betaId).not.toBe(alphaId)

    // Creating Beta made it active without dropping the Alpha membership.
    const teams = await me.query(api.teams.myTeams, {})
    expect(teams.map(x => x.name).sort()).toEqual(['Alpha', 'Beta'])
    expect(teams.find(x => x.name === 'Beta')?.isActive).toBe(true)
    expect(teams.find(x => x.name === 'Alpha')?.isActive).toBe(false)

    // Beta sees no Alpha tickets.
    expect(await me.query(api.tickets.list, { projectId: 'doko' })).toHaveLength(0)

    // Switching back to Alpha restores its data.
    const switched = await me.mutation(api.teams.setActiveTeam, { teamId: alphaId })
    expect(switched.teamName).toBe('Alpha')
    const alphaTickets = await me.query(api.tickets.list, { projectId: 'doko' })
    expect(alphaTickets.map(x => x.title)).toEqual(['Alpha task'])
    expect((await me.query(api.teams.myTeam, {}))?._id).toBe(alphaId)
  })

  test('setActiveTeam rejects teams the caller does not belong to', async () => {
    const t = convexTest(schema)
    const owner = t.withIdentity({ subject: 'owner@example.com', email: 'owner@example.com' })
    const outsider = t.withIdentity({ subject: 'outsider@example.com', email: 'outsider@example.com' })

    const teamId = await owner.mutation(api.teams.create, { name: 'Private' })
    await outsider.mutation(api.teams.create, { name: 'Elsewhere' })

    await expect(outsider.mutation(api.teams.setActiveTeam, { teamId })).rejects.toThrow(/not a member/i)
  })

  test('a user with memberships but no active pointer is still served a team', async () => {
    const t = convexTest(schema)
    const me = t.withIdentity({ subject: 'legacy@example.com', email: 'legacy@example.com' })
    const teamId = await me.mutation(api.teams.create, { name: 'Legacy' })

    // Simulate a users row whose active pointer was cleared.
    await t.run(async ctx => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_userId', q => q.eq('userId', 'legacy@example.com'))
        .first()
      if (user) await ctx.db.patch(user._id, { teamId: undefined })
    })

    expect((await me.query(api.teams.myTeam, {}))?._id).toBe(teamId)
    expect(await me.query(api.teams.myTeams, {})).toHaveLength(1)
  })
})
