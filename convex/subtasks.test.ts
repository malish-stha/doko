import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

test('subtasks CRUD flow', async () => {
  const t = convexTest(schema)
  const asUser = t.withIdentity({ subject: 'user-a', name: 'User A' })

  const { id: ticketId } = await asUser.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'task',
    title: 'Subtask test ticket',
  })

  const st1 = await asUser.mutation(api.subtasks.add, { ticketId, title: 'First subtask' })
  const st2 = await asUser.mutation(api.subtasks.add, { ticketId, title: 'Second subtask' })
  expect(st1).toBeDefined()
  expect(st2).toBeDefined()

  let list = await asUser.query(api.subtasks.byTicket, { ticketId })
  expect(list.length).toBe(2)
  expect(list[0].title).toBe('First subtask')
  expect(list[0].done).toBe(false)

  await asUser.mutation(api.subtasks.toggle, { subtaskId: st1 })
  list = await asUser.query(api.subtasks.byTicket, { ticketId })
  expect(list[0].done).toBe(true)

  await asUser.mutation(api.subtasks.remove, { subtaskId: st2 })
  list = await asUser.query(api.subtasks.byTicket, { ticketId })
  expect(list.length).toBe(1)
})
