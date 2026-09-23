import { describe, expect, test } from 'vitest'
import { extractMentionIds, parseMentionTokens } from './mentions'

describe('mentions', () => {
  test('extracts canonical email ids and legacy OIDC subjects', () => {
    const body = 'hey @[alex@example.com:Alex] and @[google-oauth2|12345:Sam] please look'
    expect(extractMentionIds(body)).toEqual(['alex@example.com', 'google-oauth2|12345'])
  })

  test('dedupes repeated mentions', () => {
    expect(extractMentionIds('@[a@x.com:A] @[a@x.com:A again]')).toEqual(['a@x.com'])
  })

  test('ignores mentions inside inline and fenced code', () => {
    const body = 'real @[a@x.com:A] `fake @[b@x.com:B]` and\n```\n@[c@x.com:C]\n```\n@[d@x.com:D]'
    expect(extractMentionIds(body)).toEqual(['a@x.com', 'd@x.com'])
    expect(parseMentionTokens(body).map(t => t.userId)).toEqual(['a@x.com', 'd@x.com'])
  })

  test('parse tokens report positions and labels', () => {
    const tokens = parseMentionTokens('cc @[a@x.com:Alex Rivera].')
    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toMatchObject({ userId: 'a@x.com', label: 'Alex Rivera', index: 3 })
  })

  test('returns nothing for empty or plain text', () => {
    expect(extractMentionIds('')).toEqual([])
    expect(extractMentionIds('no mentions here @someone')).toEqual([])
  })
})
