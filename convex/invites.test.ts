import { describe, expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import { joinTeam } from './testHelpers'

const OWNER = { subject: 'owner@example.com', email: 'owner@example.com', name: 'Owner' }
const ADMIN = { subject: 'admin@example.com', email: 'admin@example.com', name: 'Admin' }
const MEMBER = { subject: 'member@example.com', email: 'member@example.com', name: 'Member' }
const INVITEE = { subject: 'new@example.com', email: 'new@example.com', name: 'Newbie' }
const STRANGER = { subject: 'other@example.com', email: 'other@example.com', name: 'Other' }

async function inviteToken(t: ReturnType<typeof convexTest>, inviteId: string) {
  return await t.run(async ctx => {
    const inv = await ctx.db.get(inviteId as never)
    return (inv as { token: string }).token
  })
}

describe('invites', () => {
  test('emailed link: invitee joins, lands in #general, team becomes active', async () => {
    const t = convexTest(schema)
    const owner = t.withIdentity(OWNER)
    const invitee = t.withIdentity(INVITEE)

    const teamId = await owner.mutation(api.teams.create, { name: 'Alpha' })
    // The invitee already has their own workspace; accepting must not orphan it.
    const ownTeam = await invitee.mutation(api.teams.create, { name: 'Solo' })

    const inviteId = await owner.mutation(api.invites.send, { email: 'New@Example.com' })
    const token = await inviteToken(t, inviteId)

    const pending = await invitee.query(api.invites.pendingForMe, {})
    expect(pending).toHaveLength(1)
    expect('token' in pending[0]).toBe(false)

    const result = await invitee.mutation(api.invites.acceptByToken, { token })
    expect(result).toMatchObject({ teamId, teamName: 'Alpha', alreadyMember: false })

    expect((await invitee.query(api.teams.myTeam, {}))?._id).toBe(teamId)
    const teams = await invitee.query(api.teams.myTeams, {})
    expect(teams.map(x => x.teamId).sort()).toEqual([ownTeam, teamId].sort())

    const channels = await invitee.query(api.channels.byTeam, {})
    const general = channels.find(c => c.name === 'general')
    expect(general?.memberIds).toContain(INVITEE.subject)

    // Accepting twice is a no-op, not a duplicate membership.
    await expect(invitee.mutation(api.invites.acceptByToken, { token })).rejects.toThrow(/no longer valid/)
    await t.run(async ctx => {
      const rows = await ctx.db
        .query('teamMembers')
        .withIndex('by_team_user', q => q.eq('teamId', teamId).eq('userId', INVITEE.subject))
        .collect()
      expect(rows).toHaveLength(1)
    })
  })

  test('someone signed in with a different account is told whose invite it is', async () => {
    const t = convexTest(schema)
    const owner = t.withIdentity(OWNER)
    const stranger = t.withIdentity(STRANGER)
    await owner.mutation(api.teams.create, { name: 'Alpha' })
    const inviteId = await owner.mutation(api.invites.send, { email: INVITEE.email })
    const token = await inviteToken(t, inviteId)

    await expect(stranger.mutation(api.invites.acceptByToken, { token })).rejects.toThrow(
      /sent to new@example.com, but you are signed in as other@example.com/,
    )
    await expect(stranger.mutation(api.invites.accept, { inviteId })).rejects.toThrow(/signed in as/)
  })

  test('forged or tampered tokens are rejected before any lookup', async () => {
    const t = convexTest(schema)
    const invitee = t.withIdentity(INVITEE)
    await invitee.mutation(api.teams.create, { name: 'Solo' })
    await expect(invitee.mutation(api.invites.acceptByToken, { token: 'not-a-jwt' })).rejects.toThrow(
      /invalid or has expired/,
    )
  })

  test('expired invites cannot be accepted and the cron marks them expired', async () => {
    const t = convexTest(schema)
    const owner = t.withIdentity(OWNER)
    const invitee = t.withIdentity(INVITEE)
    await owner.mutation(api.teams.create, { name: 'Alpha' })
    const inviteId = await owner.mutation(api.invites.send, { email: INVITEE.email })

    await t.run(async ctx => {
      await ctx.db.patch(inviteId, { expiresAt: Date.now() - 1000 })
    })
    await expect(invitee.mutation(api.invites.accept, { inviteId })).rejects.toThrow(/expired/)

    const { expired } = await t.mutation(internal.invites.expireStale, {})
    expect(expired).toBe(1)
    await t.run(async ctx => {
      expect((await ctx.db.get(inviteId))?.status).toBe('expired')
    })
  })

  test('revoked invites are dead; only owners and admins can revoke or list', async () => {
    const t = convexTest(schema)
    const owner = t.withIdentity(OWNER)
    const admin = t.withIdentity(ADMIN)
    const member = t.withIdentity(MEMBER)
    const invitee = t.withIdentity(INVITEE)

    const teamId = await owner.mutation(api.teams.create, { name: 'Alpha' })
    await joinTeam(t, teamId, ADMIN, 'admin')
    await joinTeam(t, teamId, MEMBER, 'member')

    const inviteId = await owner.mutation(api.invites.send, { email: INVITEE.email })

    await expect(member.mutation(api.invites.revoke, { inviteId })).rejects.toThrow(/requires one of/)
    await expect(member.query(api.invites.listForTeam, {})).rejects.toThrow(/requires one of/)
    await expect(member.mutation(api.invites.send, { email: 'x@example.com' })).rejects.toThrow()

    const listed = await admin.query(api.invites.listForTeam, {})
    expect(listed).toHaveLength(1)
    expect('token' in listed[0]).toBe(false)
    expect(listed[0].deliveryStatus).toBe('queued')

    await admin.mutation(api.invites.revoke, { inviteId })
    await expect(invitee.mutation(api.invites.accept, { inviteId })).rejects.toThrow(/revoked/)
  })

  test('duplicate check is scoped per team', async () => {
    const t = convexTest(schema)
    const ownerA = t.withIdentity(OWNER)
    const ownerB = t.withIdentity(STRANGER)
    await ownerA.mutation(api.teams.create, { name: 'Alpha' })
    await ownerB.mutation(api.teams.create, { name: 'Beta' })

    await ownerA.mutation(api.invites.send, { email: INVITEE.email })
    await expect(ownerA.mutation(api.invites.send, { email: INVITEE.email })).rejects.toThrow(/already been sent/)
    // A second workspace can still invite the same person.
    await expect(ownerB.mutation(api.invites.send, { email: INVITEE.email })).resolves.toBeDefined()

    const invitee = t.withIdentity(INVITEE)
    await invitee.mutation(api.teams.create, { name: 'Solo' })
    expect(await invitee.query(api.invites.pendingForMe, {})).toHaveLength(2)
  })

  test('workspace domain is enforced when sending and again when accepting', async () => {
    const t = convexTest(schema)
    const owner = t.withIdentity(OWNER)
    const invitee = t.withIdentity(INVITEE)
    const teamId = await owner.mutation(api.teams.create, { name: 'Acme', workspaceDomain: 'example.com' })

    await expect(owner.mutation(api.invites.send, { email: 'someone@other.org' })).rejects.toThrow(/@example.com/)
    const inviteId = await owner.mutation(api.invites.send, { email: INVITEE.email })

    // Domain tightened after the invite went out: accept must re-check it.
    await t.run(async ctx => {
      await ctx.db.patch(teamId, { workspaceDomain: 'corp.example.com' })
    })
    await invitee.mutation(api.teams.create, { name: 'Solo' })
    await expect(invitee.mutation(api.invites.accept, { inviteId })).rejects.toThrow(/@corp.example.com/)
  })

  test('resend issues a fresh token and re-queues delivery', async () => {
    const t = convexTest(schema)
    const owner = t.withIdentity(OWNER)
    await owner.mutation(api.teams.create, { name: 'Alpha' })
    const inviteId = await owner.mutation(api.invites.send, { email: INVITEE.email })
    const first = await inviteToken(t, inviteId)

    await t.mutation(internal.invites.markDelivery, {
      inviteId,
      deliveryStatus: 'failed',
      lastError: 'SMTP down',
    })
    await owner.mutation(api.invites.resend, { inviteId })

    const second = await inviteToken(t, inviteId)
    expect(second).not.toBe(first)
    const [listed] = await owner.query(api.invites.listForTeam, {})
    expect(listed.deliveryStatus).toBe('queued')
    expect(listed.lastError).toBeUndefined()
  })
})
