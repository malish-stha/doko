import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

test('attachments record, query, and remove flow', async () => {
  const t = convexTest(schema)
  const userA = t.withIdentity({ subject: 'user-a', name: 'User A', email: 'usera@example.com' })

  const { id: ticketId } = await userA.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'task',
    title: 'Attachment test ticket',
  })

  const storageId = await t.run(async ctx => {
    return await ctx.storage.store(new Blob(['test content'], { type: 'text/plain' }))
  })

  const attId = await userA.mutation(api.attachments.record, {
    ticketId,
    storageId,
    filename: 'design.png',
    mimeType: 'image/png',
    size: 2048,
  })

  expect(attId).toBeDefined()

  const attachments = await userA.query(api.attachments.byTicket, { ticketId })
  expect(attachments.length).toBe(1)
  expect(attachments[0].filename).toBe('design.png')
  expect(attachments[0].size).toBe(2048)

  await userA.mutation(api.attachments.remove, { attachmentId: attId })
  const attachmentsAfter = await userA.query(api.attachments.byTicket, { ticketId })
  expect(attachmentsAfter.length).toBe(0)
})
