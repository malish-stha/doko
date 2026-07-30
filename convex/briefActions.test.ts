import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

test('generateNow executes successfully with string refId in activityEvents', async () => {
  const t = convexTest(schema)
  const asUser = t.withIdentity({ subject: 'user-a', name: 'User A', email: 'usera@example.com' })
  
  await t.run(async ctx => {
    await ctx.db.insert('activityEvents', {
      teamId: 'default-team',
      userId: 'user-a',
      kind: 'channel.created',
      refType: 'channel',
      refId: 'legacy-string-ref-id',
      payload: {},
      ts: Date.now(),
    })
  })

  const result = await asUser.action(api.briefActions.generateNow, {})
  expect(result.success).toBe(true)
  expect(result.body).toBeDefined()
})

test('generateForProvider executes with skipRateLimit flag', async () => {
  const t = convexTest(schema)
  const asUser = t.withIdentity({ subject: 'user-a', name: 'User A' })

  const [ant, goog] = await Promise.all([
    asUser.action(api.briefActions.generateForProvider, {
      userId: 'user-a',
      forDate: '2026-07-30',
      provider: 'anthropic',
      skipRateLimit: true,
    }),
    asUser.action(api.briefActions.generateForProvider, {
      userId: 'user-a',
      forDate: '2026-07-30',
      provider: 'google',
      skipRateLimit: true,
    }),
  ])

  expect(ant).toBeDefined()
  expect(goog).toBeDefined()
})

test('rate limit returns clean error message on rapid calls', async () => {
  const t = convexTest(schema)
  const asUser = t.withIdentity({ subject: 'user-b', name: 'User B', email: 'userb@example.com' })

  const res1 = await asUser.action(api.briefActions.generateNow, {})
  expect(res1.success).toBe(true)

  const res2 = await asUser.action(api.briefActions.generateNow, {})
  expect(res2.success).toBe(false)
  expect(res2.error).toContain('AI Rate Limit')
})
