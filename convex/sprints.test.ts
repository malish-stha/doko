import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

test('sprint lifecycle: create, start, and single active sprint enforcement', async () => {
  const t = convexTest(schema)
  const user = t.withIdentity({ subject: 'user-1', name: 'User One', email: 'user1@example.com' })

  // Create team
  await user.mutation(api.teams.create, { name: 'Dev Team' })

  // Create sprint 1 and sprint 2
  const sprint1Id = await user.mutation(api.sprints.create, { name: 'Sprint 1', goal: 'Ship Phase 11' })
  const sprint2Id = await user.mutation(api.sprints.create, { name: 'Sprint 2', goal: 'Ship Phase 12' })

  // List sprints for team
  const sprints = await user.query(api.sprints.listForTeam, {})
  expect(sprints.length).toBe(2)

  // Start sprint 1
  await user.mutation(api.sprints.start, { sprintId: sprint1Id, durationDays: 14 })
  const active = await user.query(api.sprints.activeSprint, {})
  expect(active?._id).toBe(sprint1Id)
  expect(active?.status).toBe('active')

  // Attempting to start sprint 2 while sprint 1 is active must throw error
  await expect(
    user.mutation(api.sprints.start, { sprintId: sprint2Id }),
  ).rejects.toThrow(/Another sprint is active/)
})

test('move ticket to sprint and complete sprint with rollover', async () => {
  const t = convexTest(schema)
  const user = t.withIdentity({ subject: 'user-1', name: 'User One', email: 'user1@example.com' })

  await user.mutation(api.teams.create, { name: 'Dev Team' })
  const sprintId = await user.mutation(api.sprints.create, { name: 'Sprint 1' })

  const ticket1 = await user.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'task',
    title: 'Task 1',
    storyPoints: 5,
  })

  const ticket2 = await user.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'bug',
    title: 'Bug 1',
    storyPoints: 3,
  })

  // Move tickets into sprint
  await user.mutation(api.sprints.moveTicket, { ticketId: ticket1.id, sprintId })
  await user.mutation(api.sprints.moveTicket, { ticketId: ticket2.id, sprintId })

  // Start sprint and check plannedPoints
  await user.mutation(api.sprints.start, { sprintId })
  const active = await user.query(api.sprints.activeSprint, {})
  expect(active?.plannedPoints).toBe(8)

  // Mark ticket 1 as done
  await user.mutation(api.tickets.updateStatus, { id: ticket1.id, status: 'done' })

  // Complete sprint with rollover to backlog
  await user.mutation(api.sprints.complete, { sprintId, rollover: 'backlog' })

  // Ticket 2 (incomplete) should be back in backlog (sprintId is undefined)
  const t2 = await user.query(api.tickets.getByKey, { key: ticket2.key })
  expect(t2?.sprintId).toBeUndefined()
})

test('epic hierarchy validation and child rollup query', async () => {
  const t = convexTest(schema)
  const user = t.withIdentity({ subject: 'user-1', name: 'User One', email: 'user1@example.com' })

  await user.mutation(api.teams.create, { name: 'Dev Team' })

  // Create an epic
  const epicRes = await user.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'epic',
    title: 'Auth Redesign',
  })

  // Attempting to assign sprint to epic must fail
  const sprintId = await user.mutation(api.sprints.create, { name: 'Sprint A' })
  await expect(
    user.mutation(api.tickets.create, {
      projectId: 'doko',
      type: 'epic',
      title: 'Nested Epic',
      sprintId,
    }),
  ).rejects.toThrow(/Epics cannot be assigned to sprints/)

  // Create child ticket under epic
  await user.mutation(api.tickets.create, {
    projectId: 'doko',
    type: 'feature',
    title: 'Google OAuth',
    epicId: epicRes.id,
    storyPoints: 8,
  })

  // Query epic children
  const children = await user.query(api.tickets.epicChildren, { epicId: epicRes.id })
  expect(children.length).toBe(1)
  expect(children[0].title).toBe('Google OAuth')
  expect(children[0].storyPoints).toBe(8)
})
