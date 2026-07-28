import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

test('getProfile and updateProfile work correctly', async () => {
  const t = convexTest(schema)
  const userA = t.withIdentity({ subject: 'user-a', email: 'alex@example.com', name: 'Alex Rivera' })

  // Initial upsert
  await userA.mutation(api.users.upsert, {
    timezone: 'Asia/Kathmandu',
    email: 'alex@example.com',
    name: 'Alex Rivera',
  })

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
