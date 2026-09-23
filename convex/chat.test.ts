import { describe, expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import { joinTeam } from './testHelpers'

const OWNER = { subject: 'owner@example.com', email: 'owner@example.com', name: 'Owner' }
const MEMBER = { subject: 'member@example.com', email: 'member@example.com', name: 'Member' }
const OUTSIDER = { subject: 'out@example.com', email: 'out@example.com', name: 'Out' }

async function setup() {
  const t = convexTest(schema)
  const owner = t.withIdentity(OWNER)
  const member = t.withIdentity(MEMBER)
  const outsider = t.withIdentity(OUTSIDER)
  const teamId = await owner.mutation(api.teams.create, { name: 'Alpha' })
  await joinTeam(t, teamId, MEMBER)
  await outsider.mutation(api.teams.create, { name: 'Beta' })
  return { t, owner, member, outsider, teamId }
}

describe('chat authorization', () => {
  test('another team cannot read, post to, or react in our channels', async () => {
    const { owner, outsider } = await setup()
    const channelId = await owner.mutation(api.channels.create, { name: 'Design Talk' })
    const messageId = await owner.mutation(api.messages.send, { channelId, body: 'hello' })

    await expect(outsider.query(api.messages.byChannel, { channelId })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.messages.send, { channelId, body: 'hi' })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.reactions.toggle, { messageId, emoji: '👍' })).rejects.toThrow(/not found/i)
    await expect(outsider.query(api.reactions.byMessage, { messageId })).rejects.toThrow(/not found/i)
    expect(await outsider.query(api.channels.get, { channelId })).toBeNull()
  })

  test('public channels are open to the team; private ones need membership', async () => {
    const { owner, member } = await setup()
    const publicId = await owner.mutation(api.channels.create, { name: 'town-hall' })
    const privateId = await owner.mutation(api.channels.create, { name: 'leads', isPrivate: true })

    // Member sees #general and #town-hall, not #leads.
    const visible = (await member.query(api.channels.byTeam, {})).map(c => c.name).sort()
    expect(visible).toEqual(['general', 'town-hall'])
    expect(await member.query(api.channels.get, { channelId: privateId })).toBeNull()
    await expect(member.mutation(api.messages.send, { channelId: privateId, body: 'x' })).rejects.toThrow(/not found/i)

    // Public channel: member can post without being in memberIds; join adds them.
    await member.mutation(api.messages.send, { channelId: publicId, body: 'hey team' })
    await member.mutation(api.channels.join, { channelId: publicId })
    await expect(member.mutation(api.channels.join, { channelId: privateId })).rejects.toThrow(/private/i)

    // Owner adds the member to the private channel.
    await owner.mutation(api.channels.addMember, { channelId: privateId, userId: MEMBER.email })
    expect((await member.query(api.channels.get, { channelId: privateId }))?.name).toBe('leads')
  })

  test('channel names are normalised and unique per team', async () => {
    const { owner } = await setup()
    await owner.mutation(api.channels.create, { name: '  Design Talk ' })
    await expect(owner.mutation(api.channels.create, { name: 'design-talk' })).rejects.toThrow(/already exists/)
    await expect(owner.mutation(api.channels.create, { name: 'general' })).rejects.toThrow(/already exists/)
    await expect(owner.mutation(api.channels.create, { name: '!!!' })).rejects.toThrow(/lowercase/)
  })

  test('thread replies must target a top-level message in the same channel', async () => {
    const { owner } = await setup()
    const a = await owner.mutation(api.channels.create, { name: 'a' })
    const b = await owner.mutation(api.channels.create, { name: 'b' })
    const rootInA = await owner.mutation(api.messages.send, { channelId: a, body: 'root' })
    const reply = await owner.mutation(api.messages.send, { channelId: a, body: 'reply', threadRootId: rootInA })

    await expect(
      owner.mutation(api.messages.send, { channelId: b, body: 'x', threadRootId: rootInA }),
    ).rejects.toThrow(/thread not found/i)
    await expect(
      owner.mutation(api.messages.send, { channelId: a, body: 'x', threadRootId: reply }),
    ).rejects.toThrow(/top-level/i)
    expect(await owner.query(api.messages.threadReplies, { rootId: rootInA })).toHaveLength(1)
  })

  test('messages store the verified author id; edit is author-only, delete allows admins', async () => {
    const { t, owner, member } = await setup()
    const channelId = await owner.mutation(api.channels.create, { name: 'room' })
    const messageId = await member.mutation(api.messages.send, { channelId, body: 'draft' })

    await t.run(async ctx => {
      expect((await ctx.db.get(messageId))?.authorId).toBe(MEMBER.subject)
    })

    const [asMember] = await member.query(api.messages.byChannel, { channelId })
    expect(asMember.authorName).toBe('Member')
    expect(asMember.canEdit).toBe(true)
    const [asOwner] = await owner.query(api.messages.byChannel, { channelId })
    expect(asOwner.canEdit).toBe(false)
    expect(asOwner.canDelete).toBe(true)

    await expect(owner.mutation(api.messages.edit, { messageId, body: 'nope' })).rejects.toThrow(/own messages/)
    await member.mutation(api.messages.edit, { messageId, body: 'final' })
    const [edited] = await member.query(api.messages.byChannel, { channelId })
    expect(edited.body).toBe('final')
    expect(edited.editedAt).toBeDefined()

    await owner.mutation(api.reactions.toggle, { messageId, emoji: '🎉' })
    await owner.mutation(api.messages.remove, { messageId })
    expect(await member.query(api.messages.byChannel, { channelId })).toHaveLength(0)
    await t.run(async ctx => {
      expect(await ctx.db.query('reactions').collect()).toHaveLength(0)
    })
  })

  test('reactions are per user, toggle cleanly, and must be emoji', async () => {
    const { owner, member } = await setup()
    const channelId = await owner.mutation(api.channels.create, { name: 'room' })
    const messageId = await owner.mutation(api.messages.send, { channelId, body: 'hi' })

    await owner.mutation(api.reactions.toggle, { messageId, emoji: '👍' })
    await member.mutation(api.reactions.toggle, { messageId, emoji: '👍' })
    expect(await owner.query(api.reactions.byMessage, { messageId })).toHaveLength(2)

    // Member toggling off removes only their own reaction.
    await member.mutation(api.reactions.toggle, { messageId, emoji: '👍' })
    const remaining = await owner.query(api.reactions.byMessage, { messageId })
    expect(remaining).toHaveLength(1)
    expect(remaining[0].userId).toBe(OWNER.subject)

    await expect(owner.mutation(api.reactions.toggle, { messageId, emoji: 'not-emoji' })).rejects.toThrow(/single emoji/)
    await expect(owner.mutation(api.reactions.toggle, { messageId, emoji: '<script>' })).rejects.toThrow(/single emoji/)
  })

  test('@mentions in chat notify teammates only', async () => {
    const { owner, member, t } = await setup()
    const channelId = await owner.mutation(api.channels.create, { name: 'room' })
    await owner.mutation(api.messages.send, {
      channelId,
      body: 'ping @[member@example.com:Member] and @[nobody@example.com:Nobody] and @[owner@example.com:Me]',
    })
    expect(await member.query(api.mentions.unreadCount, {})).toBe(1)
    expect(await owner.query(api.mentions.unreadCount, {})).toBe(0)
    await t.run(async ctx => {
      const rows = await ctx.db.query('mentions').collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].contextRefType).toBe('message')
    })
  })

  test('opening a DM by email or id yields the same canonical conversation', async () => {
    const { owner, member } = await setup()
    const a = await owner.mutation(api.channels.openDM, { otherUserId: 'Member@Example.com' })
    const b = await member.mutation(api.channels.openDM, { otherUserId: OWNER.subject })
    expect(a).toBe(b)
    await expect(owner.mutation(api.channels.openDM, { otherUserId: OWNER.email })).rejects.toThrow(/yourself/)
    await expect(owner.mutation(api.channels.openDM, { otherUserId: OUTSIDER.email })).rejects.toThrow(/not on this team/)
    expect((await owner.query(api.channels.myDMs, {}))[0]?.name).toBe('Member')
  })
})
