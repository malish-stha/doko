import { describe, test, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

describe('Multi-Team Data Isolation', () => {
  test('tickets from Team Alpha are completely invisible to Team Beta users', async () => {
    const t = convexTest(schema)

    // User A creates Team Alpha
    const userA = t.withIdentity({ subject: 'user-a', email: 'usera@alpha.com' })
    const teamAlphaId = await userA.mutation(api.teams.create, { name: 'Team Alpha' })

    // User A creates a ticket in Team Alpha
    const ticketKey = await userA.mutation(api.tickets.create, {
      projectId: 'alpha',
      type: 'feature',
      title: 'Secret Alpha Feature',
      priority: 'high',
    })

    // User B creates Team Beta
    const userB = t.withIdentity({ subject: 'user-b', email: 'userb@beta.com' })
    const teamBetaId = await userB.mutation(api.teams.create, { name: 'Team Beta' })

    // User B queries tickets
    const betaTickets = await userB.query(api.tickets.list, { projectId: 'alpha' })

    // Assert User B sees ZERO tickets from Team Alpha
    expect(betaTickets).toHaveLength(0)
    expect(teamAlphaId).not.toBe(teamBetaId)
  })
})
