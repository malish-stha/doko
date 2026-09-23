import { describe, expect, test } from 'vitest'
import { ConvexError } from 'convex/values'
import { parseConvexError } from './utils'

describe('parseConvexError', () => {
  test('returns ConvexError payloads directly', () => {
    expect(parseConvexError(new ConvexError('plain message'))).toBe('plain message')
    expect(parseConvexError(new ConvexError({ code: 'NO_TEAM', message: 'Join a team first.' }))).toBe('Join a team first.')
  })

  test('strips Convex scaffolding and keeps multi-line messages', () => {
    const err = new Error(
      '[CONVEX M(tickets:update)] [Request ID: abc123] Server Error\nUncaught Error: First line\nsecond line\n    at handler (../convex/tickets.ts:12:3)',
    )
    expect(parseConvexError(err)).toBe('First line second line')
  })

  test('extracts the message from a serialised ConvexError payload', () => {
    const err = new Error('[CONVEX M(x:y)] Server Error Uncaught ConvexError: {"code":"FORBIDDEN","message":"Only owners can do that."}')
    expect(parseConvexError(err)).toBe('Only owners can do that.')
  })

  test('handles empty input', () => {
    expect(parseConvexError(undefined)).toBe('An unexpected error occurred')
  })
})
