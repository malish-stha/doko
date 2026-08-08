import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

test('ticketLinks symmetric creation and removal', async () => {
  const t = convexTest(schema)
  const asUser = t.withIdentity({ subject: 'user-a', name: 'User A' })

  const { id: ticketA } = await asUser.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'feature',
    title: 'Feature A',
  })

  const { id: ticketB } = await asUser.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'bug',
    title: 'Bug B',
  })

  const linkId = await asUser.mutation(api.ticketLinks.create, {
    sourceId: ticketA,
    targetId: ticketB,
    type: 'blocks',
  })
  expect(linkId).toBeDefined()

  // Links for Ticket A (should show blocks Bug B)
  const linksA = await asUser.query(api.ticketLinks.forTicket, { ticketId: ticketA })
  expect(linksA.length).toBe(1)
  expect(linksA[0].link.type).toBe('blocks')
  expect(linksA[0].target?._id).toBe(ticketB)

  // Links for Ticket B (should show blocked_by Feature A)
  const linksB = await asUser.query(api.ticketLinks.forTicket, { ticketId: ticketB })
  expect(linksB.length).toBe(1)
  expect(linksB[0].link.type).toBe('blocked_by')
  expect(linksB[0].target?._id).toBe(ticketA)

  // Remove primary link
  await asUser.mutation(api.ticketLinks.remove, { linkId })

  const linksAAfter = await asUser.query(api.ticketLinks.forTicket, { ticketId: ticketA })
  const linksBAfter = await asUser.query(api.ticketLinks.forTicket, { ticketId: ticketB })
  expect(linksAAfter.length).toBe(0)
  expect(linksBAfter.length).toBe(0)
})
