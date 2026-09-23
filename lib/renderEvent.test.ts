import { describe, expect, test } from 'vitest'
import { renderEventSentence } from './renderEvent'

describe('renderEventSentence', () => {
  test('lists every changed field of an update and reads null as cleared', () => {
    const s = renderEventSentence({
      kind: 'ticket.updated',
      userName: 'Alex',
      payload: { priority: 'high', storyPoints: null, title: 'New name' },
    })
    expect(s).toBe('Alex set priority to high, cleared the story points and renamed it to "New name"')
  })

  test('covers sprint, delete and comment kinds instead of the generic fallback', () => {
    expect(renderEventSentence({ kind: 'ticket.moved_sprint', userName: 'A', payload: { sprintId: null } })).toBe(
      'A moved this ticket to the backlog',
    )
    expect(renderEventSentence({ kind: 'ticket.deleted', userName: 'A', payload: { key: 'BUG-3' } })).toBe(
      'A deleted ticket BUG-3',
    )
    expect(renderEventSentence({ kind: 'ticket.comment_deleted', userName: 'A' })).toBe('A deleted a comment')
    expect(renderEventSentence({ kind: 'subtask.renamed', userName: 'A', payload: { from: 'x', title: 'y' } })).toBe(
      'A renamed sub-task "x" to "y"',
    )
  })

  test('falls back to Teammate for anonymous actors', () => {
    expect(renderEventSentence({ kind: 'ticket.created', userName: 'anonymous' })).toBe('Teammate created this ticket')
  })
})
