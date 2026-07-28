import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

test('addComment succeeds and writes comment record', async () => {
  const t = convexTest(schema)
  const asUser = t.withIdentity({ subject: 'user-a', name: 'User A' })
  const { id: ticketId } = await asUser.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'task',
    title: 'Comment test ticket',
  })
  const commentId = await asUser.mutation(api.comments.add, {
    ticketId,
    body: 'first comment text',
  })
  expect(commentId).toBeDefined()

  const list = await asUser.query(api.comments.byTicket, { ticketId })
  expect(list.length).toBe(1)
  expect(list[0].body).toBe('first comment text')
  expect(list[0].authorId).toBe('user-a')
})
