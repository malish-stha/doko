import { describe, expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import { joinTeam } from './testHelpers'

const OWNER = { subject: 'owner@example.com', email: 'owner@example.com', name: 'Owner' }
const MEMBER = { subject: 'member@example.com', email: 'member@example.com', name: 'Member' }

describe('team membership lifecycle', () => {
  test('owner transfers ownership, then can leave; active team re-points for the leaver', async () => {
    const t = convexTest(schema)
    const owner = t.withIdentity(OWNER)
    const member = t.withIdentity(MEMBER)

    const teamId = await owner.mutation(api.teams.create, { name: 'Main' })
    await joinTeam(t, teamId, MEMBER)
    // The owner also belongs to a second team so we can see the pointer move.
    const otherId = await owner.mutation(api.teams.create, { name: 'Other' })
    await owner.mutation(api.teams.setActiveTeam, { teamId })

    await expect(owner.mutation(api.teamMembers.leave, {})).rejects.toThrow(/transfer ownership/i)

    const members = await owner.query(api.teamMembers.listForTeam, {})
    const memberRow = members.find(m => m.email === MEMBER.email)!
    await owner.mutation(api.teamMembers.transferOwnership, { memberId: memberRow._id })

    const after = await member.query(api.teamMembers.listForTeam, {})
    expect(after.find(m => m.email === MEMBER.email)?.role).toBe('owner')
    expect(after.find(m => m.email === OWNER.email)?.role).toBe('admin')

    await owner.mutation(api.teamMembers.leave, {})
    expect((await owner.query(api.teams.myTeam, {}))?._id).toBe(otherId)
    expect(await owner.query(api.teams.myTeams, {})).toHaveLength(1)
  })

  test('removing a member drops them from channels and their team watches', async () => {
    const t = convexTest(schema)
    const owner = t.withIdentity(OWNER)
    const member = t.withIdentity(MEMBER)

    const teamId = await owner.mutation(api.teams.create, { name: 'Main' })
    await joinTeam(t, teamId, MEMBER)

    const channelId = await member.mutation(api.channels.create, { name: 'design' })
    const { id: ticketId } = await owner.mutation(api.tickets.create, {
      projectId: 'doko',
      type: 'task',
      title: 'Watched',
    })
    await member.mutation(api.watchers.subscribe, { ticketId })

    const members = await owner.query(api.teamMembers.listForTeam, {})
    const memberRow = members.find(m => m.email === MEMBER.email)!
    await owner.mutation(api.teamMembers.remove, { memberId: memberRow._id })

    await t.run(async ctx => {
      const channel = await ctx.db.get(channelId)
      expect(channel?.memberIds).not.toContain(MEMBER.subject)
      const watches = await ctx.db
        .query('watchers')
        .withIndex('by_ticket_user', q => q.eq('ticketId', ticketId).eq('userId', MEMBER.subject))
        .collect()
      expect(watches).toHaveLength(0)
      const user = await ctx.db
        .query('users')
        .withIndex('by_userId', q => q.eq('userId', MEMBER.subject))
        .first()
      expect(user?.teamId).toBeUndefined()
    })

    await expect(member.query(api.teams.myTeam, {})).resolves.toBeNull()
  })

  test('a member cannot remove others or transfer ownership', async () => {
    const t = convexTest(schema)
    const owner = t.withIdentity(OWNER)
    const member = t.withIdentity(MEMBER)
    const teamId = await owner.mutation(api.teams.create, { name: 'Main' })
    await joinTeam(t, teamId, MEMBER)

    const rows = await owner.query(api.teamMembers.listForTeam, {})
    const ownerRow = rows.find(m => m.email === OWNER.email)!
    await expect(member.mutation(api.teamMembers.remove, { memberId: ownerRow._id })).rejects.toThrow()
    await expect(
      member.mutation(api.teamMembers.transferOwnership, { memberId: ownerRow._id }),
    ).rejects.toThrow()
  })
})
