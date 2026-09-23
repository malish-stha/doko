import { describe, test, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import { joinTeam } from './testHelpers'

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

describe('deleteTeam', () => {
  test('owner deletes a team: members lose access at once, data is purged in batches', async () => {
    const t = convexTest(schema)
    const OWNER = { subject: 'owner@example.com', email: 'owner@example.com', name: 'Owner' }
    const MEMBER = { subject: 'member@example.com', email: 'member@example.com', name: 'Member' }
    const owner = t.withIdentity(OWNER)
    const member = t.withIdentity(MEMBER)

    const keepId = await owner.mutation(api.teams.create, { name: 'Keep' })
    const teamId = await owner.mutation(api.teams.create, { name: 'Doomed' })
    await joinTeam(t, teamId, MEMBER)

    const { id: ticketId } = await owner.mutation(api.tickets.create, { projectId: 'doko', type: 'task', title: 'T' })
    await owner.mutation(api.comments.add, { ticketId, body: 'c' })
    await owner.mutation(api.subtasks.add, { ticketId, title: 's' })
    await member.mutation(api.watchers.subscribe, { ticketId })
    const channelId = await owner.mutation(api.channels.create, { name: 'room' })
    await owner.mutation(api.messages.send, { channelId, body: 'hi' })
    await owner.mutation(api.sprints.create, { name: 'S1' })
    await owner.mutation(api.savedFilters.create, { name: 'f', scope: 'board', queryString: 'a=b', isShared: true })
    await owner.mutation(api.boardConfig.upsert, { visibleColumns: ['todo'] })

    await expect(member.mutation(api.teams.deleteTeam, {})).rejects.toThrow(/requires one of/)
    await owner.mutation(api.teams.deleteTeam, {})

    // Access is gone immediately; the owner falls back to their other team.
    expect(await member.query(api.teams.myTeam, {})).toBeNull()
    expect((await owner.query(api.teams.myTeam, {}))?._id).toBe(keepId)

    let result = { done: false }
    for (let i = 0; i < 10 && !result.done; i++) {
      result = await t.mutation(internal.teams.purgeTeamData, { teamId })
    }
    expect(result.done).toBe(true)

    await t.run(async ctx => {
      expect(await ctx.db.get(teamId)).toBeNull()
      expect(await ctx.db.get(ticketId)).toBeNull()
      expect(await ctx.db.get(channelId)).toBeNull()
      const rows = async (table: 'comments' | 'subtasks' | 'watchers') =>
        ctx.db.query(table).withIndex('by_ticket', q => q.eq('ticketId', ticketId)).collect()
      expect(await rows('comments')).toHaveLength(0)
      expect(await rows('subtasks')).toHaveLength(0)
      expect(await rows('watchers')).toHaveLength(0)
      expect(await ctx.db.query('messages').collect()).toHaveLength(0)
      expect(await ctx.db.query('sprints').withIndex('by_team', q => q.eq('teamId', teamId)).collect()).toHaveLength(0)
      expect(await ctx.db.query('savedFilters').collect()).toHaveLength(0)
      expect(await ctx.db.query('boardConfig').collect()).toHaveLength(0)
      expect(await ctx.db.query('teamMembers').withIndex('by_team', q => q.eq('teamId', teamId)).collect()).toHaveLength(0)
      expect(
        await ctx.db.query('activityEvents').withIndex('by_team_ts', q => q.eq('teamId', teamId as string)).collect(),
      ).toHaveLength(0)
    })
  })
})
