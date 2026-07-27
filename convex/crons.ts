import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
  'morning brief tick',
  { hours: 1 },
  internal.brief.hourlyTick,
)

export default crons
