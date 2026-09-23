import { describe, expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'

describe('migrations.runAll', () => {
  test('canonicalises legacy identities, merges duplicate users and backfills team ids / dm keys / event ticket ids', async () => {
    const t = convexTest(schema)

    // Legacy world: Google-sub keyed rows, a duplicate email-keyed user, a teamless ticket, a DM without a key.
    const { teamId, ticketId, dmId, eventId } = await t.run(async ctx => {
      const teamId = await ctx.db.insert('teams', { slug: 'legacy', name: 'Legacy', ownerId: 'google|111', createdAt: 1 })
      await ctx.db.insert('users', { userId: 'google|111', email: 'Alex@Example.com', name: 'Alex', timezone: 'UTC', teamId, createdAt: 1 })
      await ctx.db.insert('users', { userId: 'alex@example.com', email: 'alex@example.com', name: 'Alex', timezone: 'UTC', jobTitle: 'Eng', createdAt: 2 })
      await ctx.db.insert('teamMembers', { teamId, userId: 'google|111', email: 'Alex@Example.com', role: 'owner', joinedAt: 1 })
      await ctx.db.insert('teamMembers', { teamId, userId: 'alex@example.com', email: 'alex@example.com', role: 'member', joinedAt: 2 })
      await ctx.db.insert('teamMembers', { teamId, userId: 'google|222', email: 'sam@example.com', role: 'member', joinedAt: 3 })
      // teamId is required by the schema now; the backfill step is exercised as a no-op.
      const ticketId = await ctx.db.insert('tickets', {
        teamId, projectId: 'doko', key: 'TASK-1', type: 'task', title: 'Old', status: 'todo', priority: 'medium',
        reporterId: 'google|111', assigneeId: 'google|222', labels: [], attachments: [], createdAt: 1, updatedAt: 1,
      })
      const dmId = await ctx.db.insert('channels', { teamId: teamId, name: 'sam', isPrivate: true, kind: 'dm', memberIds: ['google|111', 'google|222'], createdAt: 1 })
      await ctx.db.insert('watchers', { ticketId, userId: 'google|222', subscribedAt: 1 })
      const eventId = await ctx.db.insert('activityEvents', { teamId: teamId, userId: 'google|111', kind: 'ticket.created', refType: 'ticket', refId: ticketId, payload: {}, ts: 1 })
      return { teamId, ticketId, dmId, eventId }
    })

    const summary = await t.action(internal.migrations.runAll, {})
    expect(summary['users.merged']).toBe(1)
    expect(summary['teamMembers.removed']).toBe(1)

    await t.run(async ctx => {
      const users = await ctx.db.query('users').collect()
      expect(users).toHaveLength(1)
      expect(users[0]).toMatchObject({ userId: 'alex@example.com', email: 'alex@example.com', teamId, jobTitle: 'Eng' })

      const members = await ctx.db.query('teamMembers').collect()
      expect(members.map(m => [m.userId, m.role]).sort()).toEqual([
        ['alex@example.com', 'owner'],
        ['sam@example.com', 'member'],
      ])

      const ticket = await ctx.db.get(ticketId)
      expect(ticket).toMatchObject({ teamId: teamId, reporterId: 'alex@example.com', assigneeId: 'sam@example.com' })

      const dm = await ctx.db.get(dmId)
      expect(dm?.memberIds.sort()).toEqual(['alex@example.com', 'sam@example.com'])
      expect(dm?.dmKey).toBe(`dm:${teamId}:alex@example.com:sam@example.com`)

      const watch = (await ctx.db.query('watchers').collect())[0]
      expect(watch.userId).toBe('sam@example.com')

      const event = await ctx.db.get(eventId)
      expect(event?.ticketId).toBe(ticketId)
      expect(event?.userId).toBe('alex@example.com')

      expect((await ctx.db.get(teamId))?.ownerId).toBe('alex@example.com')
    })

    // The canonical user can now use the app normally.
    const alex = t.withIdentity({ subject: 'alex@example.com', email: 'alex@example.com' })
    expect((await alex.query(api.teams.myTeam, {}))?._id).toBe(teamId)
    expect((await alex.query(api.tickets.getByKey, { key: 'TASK-1' }))?.title).toBe('Old')

    // Idempotent.
    const again = await t.action(internal.migrations.runAll, {})
    expect(again['users.merged']).toBe(0)
    expect(again['tickets.teamId']).toBe(0)
  })
})
