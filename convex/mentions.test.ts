import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

test('mentions creation, query, unread count, and marking read', async () => {
  const t = convexTest(schema)
  const userA = t.withIdentity({ subject: 'user-a', name: 'User A', email: 'usera@example.com' })
  const userB = t.withIdentity({ subject: 'user-b', name: 'User B', email: 'userb@example.com' })

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
