import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Fixed to the top of the hour so the "is it 08:xx locally" check never drifts past it.
crons.hourly(
  'morning brief tick',
  { minuteUTC: 0 },
  internal.brief.hourlyTick,
)

crons.hourly(
  'expire stale invites',
  { minuteUTC: 15 },
  internal.invites.expireStale,
)

export default crons
