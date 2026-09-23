import { describe, expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import { joinTeam } from './testHelpers'

/**
 * Negative authorisation matrix: a second identity in a second team must be
 * rejected by every id-taking function, and anonymous callers by all of them.
 */

const OWNER = { subject: 'owner@a.example.com', email: 'owner@a.example.com', name: 'Owner A' }
const MEMBER = { subject: 'member@a.example.com', email: 'member@a.example.com', name: 'Member A' }
const OUTSIDER = { subject: 'owner@b.example.com', email: 'owner@b.example.com', name: 'Owner B' }

async function fixture() {
  const t = convexTest(schema)
  const owner = t.withIdentity(OWNER)
  const member = t.withIdentity(MEMBER)
  const outsider = t.withIdentity(OUTSIDER)
  const teamId = await owner.mutation(api.teams.create, { name: 'Team A' })
  await joinTeam(t, teamId, MEMBER)
  await outsider.mutation(api.teams.create, { name: 'Team B' })

  const { id: ticketId, key } = await owner.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'task',
    title: 'A task',
    description: 'Secret A details',
  })
  const { id: otherTicketId } = await owner.mutation(api.tickets.create, { projectId: 'doko', type: 'bug', title: 'A bug' })
  const commentId = await owner.mutation(api.comments.add, { ticketId, body: 'A comment' })
  const subtaskId = await owner.mutation(api.subtasks.add, { ticketId, title: 'A subtask' })
  const linkId = await owner.mutation(api.ticketLinks.create, { sourceId: ticketId, targetId: otherTicketId, type: 'relates_to' })
  const sprintId = await owner.mutation(api.sprints.create, { name: 'Sprint A' })
  return { t, owner, member, outsider, teamId, ticketId, otherTicketId, key, commentId, subtaskId, linkId, sprintId }
}

describe('cross-team access is denied', () => {
  test('tickets: reads return nothing, writes throw', async () => {
    const f = await fixture()
    const { outsider, ticketId, key } = f
    expect(await outsider.query(api.tickets.getByKey, { key })).toBeNull()
    expect(await outsider.query(api.tickets.getById, { id: ticketId })).toBeNull()
    expect(await outsider.query(api.tickets.search, { q: 'task' })).toHaveLength(0)
    expect(await outsider.query(api.tickets.epicChildren, { epicId: ticketId })).toHaveLength(0)

    await expect(outsider.mutation(api.tickets.updateStatus, { id: ticketId, status: 'done' })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.tickets.assign, { id: ticketId, assigneeId: OUTSIDER.email })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.tickets.update, { id: ticketId, title: 'pwned' })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.tickets.bulkUpdateStatus, { ticketIds: [ticketId], status: 'done' })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.tickets.bulkUpdatePriority, { ticketIds: [ticketId], priority: 'urgent' })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.tickets.bulkUpdateAssignee, { ticketIds: [ticketId], assigneeId: OUTSIDER.email })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.tickets.bulkDelete, { ticketIds: [ticketId] })).rejects.toThrow(/not found/i)

    // Cross-team epic / sprint references are rejected too.
    const { id: epicB } = await outsider.mutation(api.tickets.create, { projectId: 'doko', type: 'epic', title: 'Epic B' })
    await expect(f.owner.mutation(api.tickets.update, { id: ticketId, epicId: epicB })).rejects.toThrow(/not an epic in this team/)
    const sprintB = await outsider.mutation(api.sprints.create, { name: 'Sprint B' })
    await expect(f.owner.mutation(api.tickets.update, { id: ticketId, sprintId: sprintB })).rejects.toThrow(/sprint not found/i)

    // The ticket is untouched.
    expect((await f.owner.query(api.tickets.getByKey, { key }))?.title).toBe('A task')
  })

  test('comments, subtasks, links, watchers and events', async () => {
    const { outsider, ticketId, commentId, subtaskId, linkId, otherTicketId } = await fixture()
    await expect(outsider.query(api.comments.byTicket, { ticketId })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.comments.add, { ticketId, body: 'x' })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.comments.edit, { commentId, body: 'x' })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.comments.remove, { commentId })).rejects.toThrow(/not found/i)

    await expect(outsider.query(api.subtasks.byTicket, { ticketId })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.subtasks.add, { ticketId, title: 'x' })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.subtasks.toggle, { subtaskId })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.subtasks.rename, { subtaskId, title: 'x' })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.subtasks.remove, { subtaskId })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.subtasks.reorder, { ticketId, orderedIds: [subtaskId] })).rejects.toThrow(/not found/i)

    await expect(outsider.query(api.ticketLinks.forTicket, { ticketId })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.ticketLinks.remove, { linkId })).rejects.toThrow(/not found/i)
    const { id: bTicket } = await outsider.mutation(api.tickets.create, { projectId: 'doko', type: 'task', title: 'B' })
    await expect(
      outsider.mutation(api.ticketLinks.create, { sourceId: bTicket, targetId: otherTicketId, type: 'blocks' }),
    ).rejects.toThrow(/not found/i)

    await expect(outsider.query(api.watchers.isWatching, { ticketId })).rejects.toThrow(/not found/i)
    await expect(outsider.query(api.watchers.forTicket, { ticketId })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.watchers.subscribe, { ticketId })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.watchers.unsubscribe, { ticketId })).rejects.toThrow(/not found/i)

    await expect(outsider.query(api.events.forTicket, { ticketId })).rejects.toThrow(/not found/i)
  })

  test('sprints: foreign tickets and sprints are rejected; members cannot start or complete', async () => {
    const { owner, member, outsider, ticketId, sprintId } = await fixture()
    await expect(outsider.mutation(api.sprints.moveTicket, { ticketId, sprintId: null })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.sprints.start, { sprintId })).rejects.toThrow(/not found/i)
    await expect(outsider.mutation(api.sprints.complete, { sprintId })).rejects.toThrow(/not found/i)

    await expect(member.mutation(api.sprints.start, { sprintId })).rejects.toThrow(/requires one of/)
    await owner.mutation(api.sprints.start, { sprintId })
    await expect(member.mutation(api.sprints.complete, { sprintId })).rejects.toThrow(/requires one of/)
    await expect(outsider.mutation(api.sprints.addToActiveSprint, { ticketId })).rejects.toThrow(/no active sprint/i)
  })

  test('anonymous callers are rejected everywhere', async () => {
    const { t, ticketId, key } = await fixture()
    await expect(t.query(api.tickets.getByKey, { key })).rejects.toThrow(/signed in/i)
    await expect(t.query(api.tickets.list, { projectId: 'doko' })).rejects.toThrow(/signed in/i)
    await expect(t.mutation(api.tickets.updateStatus, { id: ticketId, status: 'done' })).rejects.toThrow(/signed in/i)
    await expect(t.query(api.comments.byTicket, { ticketId })).rejects.toThrow(/signed in/i)
    await expect(t.query(api.teams.myTeam, {})).rejects.toThrow(/signed in/i)
    await expect(t.query(api.teamMembers.listForTeam, {})).rejects.toThrow(/signed in/i)
    await expect(t.query(api.channels.byTeam, {})).rejects.toThrow(/signed in/i)
    await expect(t.query(api.invites.pendingForMe, {})).rejects.toThrow(/signed in/i)
    await expect(t.query(api.users.me, {})).rejects.toThrow(/signed in/i)
  })
})

describe('ticket rules', () => {
  test('keys are scoped per team and getByKey resolves the caller\'s team', async () => {
    const { owner, outsider, key } = await fixture()
    const { key: bKey } = await outsider.mutation(api.tickets.create, { projectId: 'doko', type: 'task', title: 'B task' })
    expect(bKey).toBe('TASK-1')
    expect(key).toBe('TASK-1')
    expect((await owner.query(api.tickets.getByKey, { key: 'TASK-1' }))?.title).toBe('A task')
    expect((await outsider.query(api.tickets.getByKey, { key: 'TASK-1' }))?.title).toBe('B task')
  })

  test('update only records fields that changed and can clear the assignee', async () => {
    const { t, owner, member, ticketId } = await fixture()
    await owner.mutation(api.tickets.update, { id: ticketId, assigneeId: MEMBER.email, priority: 'high' })
    const before = await t.run(async ctx =>
      (await ctx.db.query('activityEvents').withIndex('by_ticket_ts', q => q.eq('ticketId', ticketId)).collect()).length,
    )
    // No-op update: nothing changes, no event.
    await owner.mutation(api.tickets.update, { id: ticketId, priority: 'high' })
    const after = await t.run(async ctx =>
      (await ctx.db.query('activityEvents').withIndex('by_ticket_ts', q => q.eq('ticketId', ticketId)).collect()).length,
    )
    expect(after).toBe(before)

    await owner.mutation(api.tickets.update, { id: ticketId, assigneeId: null })
    expect((await owner.query(api.tickets.getById, { id: ticketId }))?.assigneeId).toBeUndefined()

    // The member can self-assign but not assign someone else.
    await member.mutation(api.tickets.update, { id: ticketId, assigneeId: MEMBER.email })
    await expect(member.mutation(api.tickets.update, { id: ticketId, assigneeId: OWNER.email })).rejects.toThrow(/creator or team admins/)
  })

  test('bulk delete cascades and is limited to creators/admins', async () => {
    const { t, owner, member, ticketId, commentId, subtaskId } = await fixture()
    await expect(member.mutation(api.tickets.bulkDelete, { ticketIds: [ticketId] })).rejects.toThrow(/creator or team admins/)
    await owner.mutation(api.tickets.bulkDelete, { ticketIds: [ticketId] })
    await t.run(async ctx => {
      expect(await ctx.db.get(ticketId)).toBeNull()
      expect(await ctx.db.get(commentId)).toBeNull()
      expect(await ctx.db.get(subtaskId)).toBeNull()
      expect(await ctx.db.query('ticketLinks').collect()).toHaveLength(0)
      expect(await ctx.db.query('watchers').withIndex('by_ticket', q => q.eq('ticketId', ticketId)).collect()).toHaveLength(0)
    })
  })

  test('mentions in descriptions notify teammates; dueThisWeek excludes overdue', async () => {
    const { owner, member } = await fixture()
    await owner.mutation(api.tickets.create, {
      projectId: 'doko',
      type: 'task',
      title: 'Mentioned',
      description: 'cc @[member@a.example.com:Member A]',
      // fall back on default assignments
    })
    expect(await member.query(api.mentions.unreadCount, {})).toBeGreaterThanOrEqual(1)

    const yesterday = Date.now() - 24 * 60 * 60 * 1000
    const inThreeDays = Date.now() + 3 * 24 * 60 * 60 * 1000
    const { id: overdue } = await owner.mutation(api.tickets.create, { projectId: 'doko', type: 'task', title: 'Overdue' })
    await owner.mutation(api.tickets.update, { id: overdue, dueDate: yesterday })
    const { id: soon } = await owner.mutation(api.tickets.create, { projectId: 'doko', type: 'task', title: 'Soon' })
    await owner.mutation(api.tickets.update, { id: soon, dueDate: inThreeDays })

    const due = await owner.query(api.tickets.list, { projectId: 'doko', dueThisWeek: true })
    expect(due.map(x => x.title)).toEqual(['Soon'])
  })

  test('links: contradictory and cyclic blocks are rejected; mirrors are removed together', async () => {
    const { t, owner, ticketId, otherTicketId } = await fixture()
    const { id: third } = await owner.mutation(api.tickets.create, { projectId: 'doko', type: 'task', title: 'Third' })

    await owner.mutation(api.ticketLinks.create, { sourceId: ticketId, targetId: third, type: 'blocks' })
    await expect(owner.mutation(api.ticketLinks.create, { sourceId: ticketId, targetId: third, type: 'blocked_by' })).rejects.toThrow(/conflicts/i)
    await owner.mutation(api.ticketLinks.create, { sourceId: third, targetId: otherTicketId, type: 'blocks' })
    await expect(owner.mutation(api.ticketLinks.create, { sourceId: otherTicketId, targetId: ticketId, type: 'blocks' })).rejects.toThrow(/already blocks/)

    const links = await owner.query(api.ticketLinks.forTicket, { ticketId })
    const blocking = links.find(l => l.link.type === 'blocks')!
    await owner.mutation(api.ticketLinks.remove, { linkId: blocking.link._id })
    await t.run(async ctx => {
      const rows = await ctx.db.query('ticketLinks').collect()
      expect(rows.some(r => r.sourceId === third && r.targetId === ticketId)).toBe(false)
    })
  })

  test('sprint plannedPoints track ticket moves and estimates; completedAt is recorded', async () => {
    const { owner, ticketId, otherTicketId, sprintId } = await fixture()
    await owner.mutation(api.tickets.update, { id: ticketId, storyPoints: 5 })
    await owner.mutation(api.sprints.moveTicket, { ticketId, sprintId })
    await owner.mutation(api.sprints.start, { sprintId, durationDays: 10 })
    expect((await owner.query(api.sprints.activeSprint, {}))?.plannedPoints).toBe(5)

    await owner.mutation(api.tickets.update, { id: otherTicketId, storyPoints: 3 })
    await owner.mutation(api.sprints.addToActiveSprint, { ticketId: otherTicketId })
    expect((await owner.query(api.sprints.activeSprint, {}))?.plannedPoints).toBe(8)

    await owner.mutation(api.tickets.update, { id: ticketId, storyPoints: 1 })
    expect((await owner.query(api.sprints.activeSprint, {}))?.plannedPoints).toBe(4)

    await expect(owner.mutation(api.sprints.start, { sprintId, durationDays: 500 })).rejects.toThrow()
    await expect(owner.mutation(api.sprints.complete, { sprintId, rollover: sprintId })).rejects.toThrow(/being completed/)

    const before = (await owner.query(api.sprints.listForTeam, {}))[0]
    await owner.mutation(api.sprints.complete, { sprintId })
    const done = (await owner.query(api.sprints.listForTeam, { status: 'completed' }))[0]
    expect(done.completedAt).toBeDefined()
    expect(done.endDate).toBe(before.endDate)
  })
})
