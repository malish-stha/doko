import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'
import { joinTeam } from './testHelpers'
import type { Id } from './_generated/dataModel'

const OWNER = { subject: 'owner@example.com', email: 'owner@example.com', name: 'Owner' }
const MEMBER = { subject: 'member@example.com', email: 'member@example.com', name: 'Member' }
const OUTSIDER = { subject: 'out@example.com', email: 'out@example.com', name: 'Out' }

async function setup() {
  const t = convexTest(schema)
  const owner = t.withIdentity(OWNER)
  const member = t.withIdentity(MEMBER)
  const outsider = t.withIdentity(OUTSIDER)
  const teamId = await owner.mutation(api.teams.create, { name: 'Test Team' })
  await joinTeam(t, teamId, MEMBER)
  await outsider.mutation(api.teams.create, { name: 'Other Team' })
  const { id: ticketId } = await owner.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'task',
    title: 'Attachment test ticket',
  })
  // convex-test does not record a content type in _storage, so tests pass mimeType explicitly
  // (production reads it from storage metadata first).
  const store = (content: string) => t.run(async ctx => await ctx.storage.store(new Blob([content])))
  return { t, owner, member, outsider, ticketId, store }
}

function idOf(result: { ok: true; attachmentId: Id<'attachments'> } | { ok: false; error: string }) {
  if (!result.ok) throw new Error(result.error)
  return result.attachmentId
}

describe('attachments', () => {
  test('record uses storage size; uploader and admins can delete', async () => {
    const { t, owner, member, ticketId, store } = await setup()
    const storageId = await store('test content')

    const result = await member.mutation(api.attachments.record, {
      ticketId,
      storageId,
      filename: 'notes.txt',
      mimeType: 'text/plain',
      size: 2048, // ignored: storage says 12 bytes
    })
    const attId = idOf(result)

    const rows = await owner.query(api.attachments.byTicket, { ticketId })
    expect(rows).toHaveLength(1)
    expect(rows[0].filename).toBe('notes.txt')
    expect(rows[0].mimeType).toBe('text/plain')
    expect(rows[0].size).toBe(12)
    expect(rows[0].url).toBeTruthy()
    expect(rows[0].canDelete).toBe(true) // owner is an admin

    const asMember = await member.query(api.attachments.byTicket, { ticketId })
    expect(asMember[0].canDelete).toBe(true) // uploader

    // Recording the same upload twice is refused.
    const dup = await member.mutation(api.attachments.record, { ticketId, storageId, filename: 'dup.txt', mimeType: 'text/plain' })
    expect(dup).toMatchObject({ ok: false, error: expect.stringMatching(/already been attached/) })

    await owner.mutation(api.attachments.remove, { attachmentId: attId })
    expect(await owner.query(api.attachments.byTicket, { ticketId })).toHaveLength(0)
    await t.run(async ctx => {
      expect(await ctx.db.system.get(storageId)).toBeNull()
    })
  })

  test('a member who did not upload cannot delete', async () => {
    const { owner, member, ticketId, store } = await setup()
    const storageId = await store('owner file')
    const attId = idOf(await owner.mutation(api.attachments.record, { ticketId, storageId, filename: 'a.txt', mimeType: 'text/plain' }))
    const [row] = await member.query(api.attachments.byTicket, { ticketId })
    expect(row.canDelete).toBe(false)
    await expect(member.mutation(api.attachments.remove, { attachmentId: attId })).rejects.toThrow(/uploader or a team admin/)
  })

  test('other teams cannot list, record against, or delete our attachments', async () => {
    const { outsider, owner, ticketId, store } = await setup()
    const storageId = await store('x')
    const attId = idOf(await owner.mutation(api.attachments.record, { ticketId, storageId, filename: 'a.txt', mimeType: 'text/plain' }))
    await expect(outsider.query(api.attachments.byTicket, { ticketId })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.attachments.remove, { attachmentId: attId })).rejects.toThrow(/not found/i)
    const foreignBlob = await store('y')
    await expect(
      outsider.mutation(api.attachments.record, { ticketId, storageId: foreignBlob, filename: 'b.txt', mimeType: 'text/plain' }),
    ).rejects.toThrow(/not found/i)
    await expect(outsider.query(api.tickets.getAttachmentUrl, { storageId })).resolves.toBeNull()
    expect(await owner.query(api.tickets.getAttachmentUrl, { storageId })).toBeTruthy()
  })

  test('HTML and SVG uploads are rejected and the blob is discarded', async () => {
    const { t, owner, ticketId, store } = await setup()
    for (const [content, type] of [
      ['<script>alert(1)</script>', 'text/html'],
      ['<svg onload="alert(1)"/>', 'image/svg+xml'],
      ['binary', 'application/octet-stream'],
    ] as const) {
      const storageId = await store(content)
      const result = await owner.mutation(api.attachments.record, { ticketId, storageId, filename: 'evil', mimeType: type })
      expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/cannot be attached/) })
      await t.run(async ctx => {
        expect(await ctx.db.system.get(storageId)).toBeNull()
      })
    }
    expect(await owner.query(api.attachments.byTicket, { ticketId })).toHaveLength(0)
  })
})
