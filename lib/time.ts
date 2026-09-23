/**
 * Timezone helpers built on Intl.DateTimeFormat.formatToParts, which is
 * locale-independent (unlike toLocaleString().split(',')).
 */

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function parts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const out: Record<string, string> = {}
  for (const p of fmt.formatToParts(date)) if (p.type !== 'literal') out[p.type] = p.value
  return out
}

/** YYYY-MM-DD for `date` as seen in `tz`. Falls back to UTC for an invalid zone. */
export function localDateString(tz: string, date: Date = new Date()): string {
  const zone = isValidTimezone(tz) ? tz : 'UTC'
  const p = parts(date, zone)
  return `${p.year}-${p.month}-${p.day}`
}

/** Hour of day (0-23) for `date` as seen in `tz`. */
export function localHour(tz: string, date: Date = new Date()): number {
  const zone = isValidTimezone(tz) ? tz : 'UTC'
  return Number(parts(date, zone).hour)
}

/**
 * Epoch ms of local midnight at the start of `yyyyMmDd` in `tz`.
 * Iterates once to correct for the zone offset (handles DST edges).
 */
export function startOfLocalDay(yyyyMmDd: string, tz: string): number {
  const zone = isValidTimezone(tz) ? tz : 'UTC'
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  let guess = Date.UTC(y, m - 1, d, 0, 0, 0)
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(guess), zone)
    const seenAsUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
    guess += Date.UTC(y, m - 1, d) - seenAsUtc
  }
  return guess
}

export const DAY_MS = 24 * 60 * 60 * 1000
