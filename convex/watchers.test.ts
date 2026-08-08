import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

test('watchers subscribe, auto-subscribe reporter, and list watchers', async () => {
  const t = convexTest(schema)
  const userA = t.withIdentity({ subject: 'user-a', name: 'User A', email: 'usera@example.com' })
  const userB = t.withIdentity({ subject: 'user-b', name: 'User B', email: 'userb@example.com' })

  const { id: ticketId } = await userA.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'task',
    title: 'Watcher test ticket',
  })

  // User A (reporter) is auto-subscribed as watcher
  const isAWatching = await userA.query(api.watchers.isWatching, { ticketId })
  expect(isAWatching).toBe(true)

  // User B subscribes
  await userB.mutation(api.watchers.subscribe, { ticketId })
  const isBWatching = await userB.query(api.watchers.isWatching, { ticketId })
  expect(isBWatching).toBe(true)

  const watchersList = await userA.query(api.watchers.forTicket, { ticketId })
  expect(watchersList.length).toBe(2)

  // User B unsubscribes
  await userB.mutation(api.watchers.unsubscribe, { ticketId })
  const isBWatchingAfter = await userB.query(api.watchers.isWatching, { ticketId })
  expect(isBWatchingAfter).toBe(false)
})
