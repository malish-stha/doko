import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

test('ticket key generation is monotonic per type prefix', async () => {
  const t = convexTest(schema)
  const asUser = t.withIdentity({ subject: 'user-a', name: 'A' })
  const first = await asUser.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'bug',
    title: 'first bug',
  })
  const second = await asUser.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'bug',
    title: 'second bug',
  })
  const firstTask = await asUser.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'task',
    title: 'task 1',
  })
  expect(first.key).toBe('BUG-1')
  expect(second.key).toBe('BUG-2')
  expect(firstTask.key).toBe('TASK-1')
})

test('create ticket writes activityEvent to database', async () => {
  const t = convexTest(schema)
  const asUser = t.withIdentity({ subject: 'user-a', name: 'A' })
  const { key } = await asUser.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'feature',
    title: 'New Feature',
  })
  const ticket = await asUser.query(api.tickets.getByKey, { key })
  expect(ticket?.title).toBe('New Feature')
})

test('updateStatus changes ticket status and updates record', async () => {
  const t = convexTest(schema)
  const asUser = t.withIdentity({ subject: 'user-a' })
  const { id } = await asUser.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'task',
    title: 'Status Test',
  })
  await asUser.mutation(api.tickets.updateStatus, { id, status: 'in_progress' })
  const ticket = await asUser.query(api.tickets.getByKey, { key: 'TASK-1' })
  expect(ticket?.status).toBe('in_progress')
})

test('list query filters by mine flag correctly — no cross-user leak', async () => {
  const t = convexTest(schema)
  const asA = t.withIdentity({ subject: 'user-a' })
  const asB = t.withIdentity({ subject: 'user-b' })

  await asA.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'bug',
    title: 'A private ticket',
  })
  await asB.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'bug',
    title: 'B private ticket',
  })

  const bViewMine = await asB.query(api.tickets.list, {
    projectId: 'doko',
    mine: true,
  })

  // Ensure user B does NOT see user A's ticket when mine=true
  const leaked = bViewMine.some(t => t.title === 'A private ticket')
  expect(leaked).toBe(false)
})

test('creator can assign ticket to another user', async () => {
  const t = convexTest(schema)
  const asA = t.withIdentity({ subject: 'user-a', email: 'user-a@example.com' })
  const { id, key } = await asA.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'task',
    title: 'Assignment test',
  })

  await asA.mutation(api.tickets.assign, {
    id,
    assigneeId: 'user-b@example.com',
  })

  const updated = await asA.query(api.tickets.getByKey, { key })
  expect(updated?.assigneeId).toBe('user-b@example.com')
})

test('user can assign ticket to themselves', async () => {
  const t = convexTest(schema)
  const asA = t.withIdentity({ subject: 'user-a', email: 'user-a@example.com' })
  const asB = t.withIdentity({ subject: 'user-b', email: 'user-b@example.com' })

  const { id, key } = await asA.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'task',
    title: 'Self assignment test',
  })

  // User B assigns ticket to themselves
  await asB.mutation(api.tickets.assign, {
    id,
    assigneeId: 'user-b@example.com',
  })

  const updated = await asB.query(api.tickets.getByKey, { key })
  expect(updated?.assigneeId).toBe('user-b@example.com')
})

test('non-creator cannot assign ticket to another third user', async () => {
  const t = convexTest(schema)
  const asA = t.withIdentity({ subject: 'user-a', email: 'user-a@example.com' })
  const asB = t.withIdentity({ subject: 'user-b', email: 'user-b@example.com' })

  const { id } = await asA.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'bug',
    title: 'Unauthorized assignment test',
  })

  // User B tries to assign User A's ticket to User C
  await expect(
    asB.mutation(api.tickets.assign, {
      id,
      assigneeId: 'user-c@example.com',
    }),
  ).rejects.toThrow(/Unauthorized/)
})

