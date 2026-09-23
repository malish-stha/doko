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

describe('board config', () => {
  test('only owners/admins change the board; values are validated', async () => {
    const { owner, member } = await setup()
    await expect(member.mutation(api.boardConfig.upsert, { wipLimits: { todo: 2 } })).rejects.toThrow(/requires one of/)
    await expect(owner.mutation(api.boardConfig.upsert, { wipLimits: { todo: -1 } })).rejects.toThrow(/whole number/)
    await expect(owner.mutation(api.boardConfig.upsert, { visibleColumns: [] })).rejects.toThrow(/at least one/i)
    await expect(owner.mutation(api.boardConfig.upsert, { visibleColumns: ['todo', 'todo'] })).rejects.toThrow(/twice/)

    await owner.mutation(api.boardConfig.upsert, {
      wipLimits: { in_progress: 1 },
      visibleColumns: ['todo', 'in_progress', 'done'],
      columnLabels: { in_progress: '  Doing  ' },
    })
    const config = await member.query(api.boardConfig.forMyTeam, {})
    expect(config?.visibleColumns).toEqual(['todo', 'in_progress', 'done'])
    expect(config?.columnLabels?.in_progress).toBe('Doing')
    expect(config?.wipLimits.in_progress).toBe(1)
  })

  test('WIP limits are enforced for single and bulk status changes', async () => {
    const { owner } = await setup()
    await owner.mutation(api.boardConfig.upsert, { wipLimits: { in_progress: 1 } })
    const a = await owner.mutation(api.tickets.create, { projectId: 'doko', type: 'task', title: 'A' })
    const b = await owner.mutation(api.tickets.create, { projectId: 'doko', type: 'task', title: 'B' })
    const c = await owner.mutation(api.tickets.create, { projectId: 'doko', type: 'task', title: 'C' })

    await owner.mutation(api.tickets.updateStatus, { id: a.id, status: 'in_progress' })
    await expect(owner.mutation(api.tickets.updateStatus, { id: b.id, status: 'in_progress' })).rejects.toThrow(/WIP limit/)
    await expect(
      owner.mutation(api.tickets.bulkUpdateStatus, { ticketIds: [b.id, c.id], status: 'in_progress' }),
    ).rejects.toThrow(/WIP limit/)

    // Moving the occupant out frees the slot; re-setting the same status is a no-op.
    await owner.mutation(api.tickets.updateStatus, { id: a.id, status: 'review' })
    await owner.mutation(api.tickets.updateStatus, { id: b.id, status: 'in_progress' })
    await owner.mutation(api.tickets.updateStatus, { id: b.id, status: 'in_progress' })
    expect((await owner.query(api.tickets.getById, { id: b.id }))?.status).toBe('in_progress')
  })
})

describe('saved filters', () => {
  test('personal views are team-scoped; shared views reach the team; owner-only edits', async () => {
    const { owner, member, outsider } = await setup()
    const mine = await owner.mutation(api.savedFilters.create, { name: 'Mine', scope: 'board', queryString: '?mine=1', isShared: false })
    await owner.mutation(api.savedFilters.create, { name: 'Team urgent', scope: 'board', queryString: 'hipri=1', isShared: true })

    const ownerViews = await owner.query(api.savedFilters.myFilters, { scope: 'board' })
    expect(ownerViews.map(v => v.name).sort()).toEqual(['Mine', 'Team urgent'])
    expect(ownerViews.find(v => v.name === 'Mine')?.queryString).toBe('mine=1')

    const memberViews = await member.query(api.savedFilters.myFilters, { scope: 'board' })
    expect(memberViews.map(v => v.name)).toEqual(['Team urgent'])
    expect(memberViews[0].isMine).toBe(false)

    expect(await outsider.query(api.savedFilters.myFilters, { scope: 'board' })).toHaveLength(0)

    await expect(member.mutation(api.savedFilters.remove, { id: mine })).rejects.toThrow(/owner/i)
    await expect(member.mutation(api.savedFilters.update, { id: mine, name: 'x' })).rejects.toThrow(/owner/i)
    await expect(member.mutation(api.savedFilters.share, { id: mine, isShared: true })).rejects.toThrow(/owner/i)
    await expect(outsider.mutation(api.savedFilters.update, { id: mine, name: 'x' })).rejects.toThrow(/not found/i)

    await owner.mutation(api.savedFilters.update, { id: mine, name: 'Renamed', queryString: 'mine=1&hipri=1' })
    const after = await owner.query(api.savedFilters.myFilters, { scope: 'board' })
    expect(after.find(v => v._id === mine)).toMatchObject({ name: 'Renamed', queryString: 'mine=1&hipri=1' })

    // A view in another team of the same user does not leak across teams.
    await owner.mutation(api.teams.create, { name: 'Second' })
    expect(await owner.query(api.savedFilters.myFilters, { scope: 'board' })).toHaveLength(0)
  })

  test('names are required and there is a per-user cap', async () => {
    const { owner } = await setup()
    await expect(
      owner.mutation(api.savedFilters.create, { name: '   ', scope: 'list', queryString: '', isShared: false }),
    ).rejects.toThrow(/name/i)
    for (let i = 0; i < 50; i++) {
      await owner.mutation(api.savedFilters.create, { name: `v${i}`, scope: 'list', queryString: `i=${i}`, isShared: false })
    }
    await expect(
      owner.mutation(api.savedFilters.create, { name: 'one more', scope: 'list', queryString: 'x=1', isShared: false }),
    ).rejects.toThrow(/up to 50/)
  })
})
