import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'
import { joinTeam } from './testHelpers'

test('getProfile and updateProfile work correctly', async () => {
  const t = convexTest(schema)
  const userA = t.withIdentity({ subject: 'user-a', email: 'alex@example.com', name: 'Alex Rivera' })

  // Initial upsert
  await userA.mutation(api.users.upsert, { timezone: 'Asia/Kathmandu' })

  // Get initial profile
  const initialProfile = await userA.query(api.users.getProfile, {})
  expect(initialProfile).toBeDefined()
  expect(initialProfile?.email).toBe('alex@example.com')
  expect(initialProfile?.isSelf).toBe(true)

  // Update profile with job title, department, location, etc.
  await userA.mutation(api.users.updateProfile, {
    jobTitle: 'Senior Software Engineer',
    department: 'Engineering',
    location: 'Kathmandu Office',
    phone: '+977 9801234567',
    bio: 'Building awesome apps with Next.js and Convex.',
  })

  // Get updated profile
  const updatedProfile = await userA.query(api.users.getProfile, {})
  expect(updatedProfile?.jobTitle).toBe('Senior Software Engineer')
  expect(updatedProfile?.department).toBe('Engineering')
  expect(updatedProfile?.location).toBe('Kathmandu Office')
  expect(updatedProfile?.phone).toBe('+977 9801234567')
  expect(updatedProfile?.bio).toBe('Building awesome apps with Next.js and Convex.')
})

test('profiles are visible to teammates only, and contact details only to the owner', async () => {
  const t = convexTest(schema)
  const alex = t.withIdentity({ subject: 'alex@example.com', email: 'alex@example.com', name: 'Alex' })
  const sam = t.withIdentity({ subject: 'sam@example.com', email: 'sam@example.com', name: 'Sam' })
  const outsider = t.withIdentity({ subject: 'out@example.com', email: 'out@example.com', name: 'Out' })

  const teamId = await alex.mutation(api.teams.create, { name: 'Alpha' })
  await joinTeam(t, teamId, { subject: 'sam@example.com', email: 'sam@example.com', name: 'Sam' })
  await outsider.mutation(api.teams.create, { name: 'Elsewhere' })
  await alex.mutation(api.users.upsert, { timezone: 'UTC' })
  await alex.mutation(api.users.updateProfile, { phone: '+1 555 0100', location: 'Kathmandu', jobTitle: 'Eng' })

  const self = await alex.query(api.users.getProfile, {})
  expect(self?.phone).toBe('+1 555 0100')

  const asTeammate = await sam.query(api.users.getProfile, { targetUserId: 'alex@example.com' })
  expect(asTeammate?.jobTitle).toBe('Eng')
  expect(asTeammate?.phone).toBeUndefined()
  expect(asTeammate?.location).toBeUndefined()

  expect(await outsider.query(api.users.getProfile, { targetUserId: 'alex@example.com' })).toBeNull()
  expect(await outsider.query(api.users.getTeammate, { userId: 'alex@example.com' })).toBeNull()
  expect((await sam.query(api.users.getTeammate, { userId: 'alex@example.com' }))?.name).toBe('Alex')
})

test('updateProfile clears fields with null and rejects unsafe URLs', async () => {
  const t = convexTest(schema)
  const alex = t.withIdentity({ subject: 'alex@example.com', email: 'alex@example.com', name: 'Alex' })
  await alex.mutation(api.teams.create, { name: 'Alpha' })

  await alex.mutation(api.users.updateProfile, { bio: 'hello', githubUrl: 'https://github.com/alex' })
  expect((await alex.query(api.users.getProfile, {}))?.bio).toBe('hello')

  await alex.mutation(api.users.updateProfile, { bio: null })
  expect((await alex.query(api.users.getProfile, {}))?.bio).toBeUndefined()

  await expect(alex.mutation(api.users.updateProfile, { avatarUrl: 'javascript:alert(1)' })).rejects.toThrow(/https/)
  await expect(alex.mutation(api.users.updateProfile, { avatarUrl: 'https://evil.example.com/a.png' })).rejects.toThrow(/hosted on/)
  await expect(alex.mutation(api.users.updateProfile, { linkedinUrl: 'https://phish.example.com' })).rejects.toThrow(/linkedin/)
  await expect(alex.mutation(api.users.updateProfile, { timezone: 'Mars/Olympus' })).rejects.toThrow(/timezone/i)
})
