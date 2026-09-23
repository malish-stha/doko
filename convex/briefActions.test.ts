import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from './schema'
import { api, internal } from './_generated/api'
import { joinTeam } from './testHelpers'

// LLM_MOCK=1 (vitest.config.ts) makes summarize() return canned text without a provider key.

const A = { subject: 'usera@example.com', email: 'usera@example.com', name: 'User A' }
const B = { subject: 'userb@example.com', email: 'userb@example.com', name: 'User B' }

describe('morning brief generation', () => {
  test('generateNow writes a brief from the caller\'s team activity and records quota afterwards', async () => {
    const t = convexTest(schema)
    const asA = t.withIdentity(A)
    const teamId = await asA.mutation(api.teams.create, { name: 'Team' })
    await asA.mutation(api.users.upsert, { timezone: 'UTC' })
    await asA.mutation(api.tickets.create, { projectId: 'doko', type: 'task', title: 'Ship it' })
    // A legacy event with a non-id refId must not break context loading.
    await t.run(async ctx => {
      await ctx.db.insert('activityEvents', {
        teamId: teamId as string,
        userId: A.subject,
        kind: 'channel.created',
        refType: 'channel',
        refId: 'legacy-string-ref-id',
        payload: {},
        ts: Date.now(),
      })
    })

    const result = await asA.action(api.briefActions.generateNow, {})
    expect(result.success).toBe(true)
    if (result.success) expect(result.body).toContain('[mock brief]')

    const brief = await asA.query(api.brief.todayForMe, {})
    expect(brief?.body).toContain('[mock brief]')
    expect(brief?.providerUsed).toBe('anthropic/mock')
    expect(brief?.sourceEventIds.length).toBeGreaterThan(0)

    // Cooldown applies only after a successful generation.
    const second = await asA.action(api.briefActions.generateNow, {})
    expect(second.success).toBe(false)
    if (!second.success) expect(second.error).toContain('AI Rate Limit')
  })

  test('anonymous callers get a clean failure, not a fabricated brief', async () => {
    const t = convexTest(schema)
    const res = await t.action(api.briefActions.generateNow, {})
    expect(res).toMatchObject({ success: false, code: 'UNAUTHENTICATED' })
  })

  test('brief context excludes private channels and DMs the user is not in', async () => {
    const t = convexTest(schema)
    const asA = t.withIdentity(A)
    const teamId = await asA.mutation(api.teams.create, { name: 'Team' })
    await joinTeam(t, teamId, B)

    const publicId = await asA.mutation(api.channels.create, { name: 'town-hall' })
    const privateId = await asA.mutation(api.channels.create, { name: 'leads', isPrivate: true })
    await asA.mutation(api.messages.send, { channelId: publicId, body: 'public note' })
    await asA.mutation(api.messages.send, { channelId: privateId, body: 'secret note' })

    const ctxB = await t.query(internal.brief.readContext, { userId: B.subject })
    const previews = ctxB.events.map(e => String((e.payload as { bodyPreview?: string })?.bodyPreview ?? ''))
    expect(previews).toContain('public note')
    expect(previews).not.toContain('secret note')
    // Channel creation events for the private channel are hidden too.
    expect(ctxB.events.some(e => e.refType === 'channel' && e.refId === privateId)).toBe(false)
    expect(ctxB.events.some(e => e.refType === 'channel' && e.refId === publicId)).toBe(true)
  })

  test('compareProviders runs under the caller identity with a validated provider', async () => {
    const t = convexTest(schema)
    const asA = t.withIdentity(A)
    await asA.mutation(api.teams.create, { name: 'Team' })
    const res = await asA.action(api.briefActions.compareProviders, { provider: 'google' })
    expect(res.success).toBe(true)
    if (res.success) expect(res.model).toBe('mock')
    await expect(
      // @ts-expect-error invalid provider is rejected by the validator
      asA.action(api.briefActions.compareProviders, { provider: 'openai' }),
    ).rejects.toThrow()
  })

  test('rate limit: quota is checked on every call and consumed only via record', async () => {
    const t = convexTest(schema)
    const userId = 'rl@example.com'
    await t.mutation(internal.rateLimit.check, { userId, actionType: 'x' })
    await t.mutation(internal.rateLimit.check, { userId, actionType: 'x' }) // no record yet: still allowed
    await t.mutation(internal.rateLimit.record, { userId, actionType: 'x' })
    await expect(t.mutation(internal.rateLimit.check, { userId, actionType: 'x' })).rejects.toThrow(/wait/)
  })
})
