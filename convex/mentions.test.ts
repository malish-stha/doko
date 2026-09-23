import { joinTeam } from './testHelpers'
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

test('mentions creation, query, unread count, and marking read', async () => {
  const t = convexTest(schema)
  const userA = t.withIdentity({ subject: 'user-a', name: 'User A', email: 'usera@example.com' })
  const userB = t.withIdentity({ subject: 'user-b', name: 'User B', email: 'userb@example.com' })
  const teamId = await userA.mutation(api.teams.create, { name: 'Test Team' })
  await joinTeam(t, teamId, { subject: 'user-b', email: 'userb@example.com', name: 'User B' })

  const { id: ticketId } = await userA.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'task',
    title: 'Mention test ticket',
  })

  // User A posts a comment mentioning User B: @[user-b:User B]
  await userA.mutation(api.comments.add, {
    ticketId,
    body: 'Hey @[user-b:User B] please check this out',
  })

  // User B queries mentions
  const count = await userB.query(api.mentions.unreadCount, {})
  expect(count).toBe(1)

  const mentions = await userB.query(api.mentions.forMe, { read: false })
  expect(mentions.length).toBe(1)
  expect(mentions[0].mentionedUserId).toBe('user-b')
  expect(mentions[0].mentionedByUserId).toBe('user-a')

  // User B marks mention as read
  await userB.mutation(api.mentions.markRead, { mentionId: mentions[0]._id })
  const countAfter = await userB.query(api.mentions.unreadCount, {})
  expect(countAfter).toBe(0)
})

test('watcher notifications fold into one unread row per ticket and stay team-scoped', async () => {
  const t = convexTest(schema)
  const userA = t.withIdentity({ subject: 'user-a', name: 'User A', email: 'usera@example.com' })
  const userB = t.withIdentity({ subject: 'user-b', name: 'User B', email: 'userb@example.com' })
  const teamId = await userA.mutation(api.teams.create, { name: 'Test Team' })
  await joinTeam(t, teamId, { subject: 'user-b', email: 'userb@example.com', name: 'User B' })

  const { id: ticketId } = await userA.mutation(api.tickets.create, { projectId: 'doko', type: 'task', title: 'Watched' })
  await userB.mutation(api.watchers.subscribe, { ticketId })

  // Three separate activities by A -> one notification for B, count 3.
  await userA.mutation(api.tickets.updateStatus, { id: ticketId, status: 'todo' })
  await userA.mutation(api.tickets.updateStatus, { id: ticketId, status: 'in_progress' })
  await userA.mutation(api.subtasks.add, { ticketId, title: 'step' })

  expect(await userB.query(api.mentions.unreadCount, {})).toBe(1)
  const [row] = await userB.query(api.mentions.forMe, { read: false })
  expect(row.count).toBe(3)
  expect(row.contextDetail?.kind).toBe('ticket')

  // Only the recipient may mark it read.
  await expect(userA.mutation(api.mentions.markRead, { mentionId: row._id })).rejects.toThrow(/not found/i)
  await userB.mutation(api.mentions.markRead, { mentionId: row._id })
  expect(await userB.query(api.mentions.unreadCount, {})).toBe(0)

  // B switches to another team: A's team notifications disappear from the inbox there.
  await userA.mutation(api.tickets.updateStatus, { id: ticketId, status: 'review' })
  expect(await userB.query(api.mentions.unreadCount, {})).toBe(1)
  const other = await userB.mutation(api.teams.create, { name: 'B Solo' })
  expect(other).toBeDefined()
  expect(await userB.query(api.mentions.unreadCount, {})).toBe(0)
  expect(await userB.query(api.mentions.forMe, {})).toHaveLength(0)
})

test('a mention pointing at a deleted or malformed context is skipped, not fatal', async () => {
  const t = convexTest(schema)
  const userA = t.withIdentity({ subject: 'user-a', name: 'User A', email: 'usera@example.com' })
  await userA.mutation(api.teams.create, { name: 'Test Team' })
  await t.run(async ctx => {
    await ctx.db.insert('mentions', {
      contextRefType: 'ticket',
      contextRefId: 'not-an-id',
      mentionedUserId: 'user-a',
      mentionedByUserId: 'someone',
      read: false,
      createdAt: Date.now(),
    })
  })
  expect(await userA.query(api.mentions.forMe, {})).toHaveLength(0)
  expect(await userA.query(api.mentions.unreadCount, {})).toBe(0)
})
