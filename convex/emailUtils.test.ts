import { describe, expect, test } from 'vitest'
import { escapeHtml, getAppUrl } from './emailUtils'

describe('emailUtils', () => {
  test('escapeHtml neutralises markup in team names and addresses', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;')
    expect(escapeHtml(`Bob's "Team" & co`)).toBe('Bob&#39;s &quot;Team&quot; &amp; co')
    expect(escapeHtml(undefined)).toBe('')
  })

  test('getAppUrl requires APP_URL and strips trailing slashes', () => {
    expect(getAppUrl({ APP_URL: 'https://doko.example.com/' })).toBe('https://doko.example.com')
    expect(getAppUrl({ NEXT_PUBLIC_APP_URL: 'https://doko.example.com' })).toBe('https://doko.example.com')
    expect(() => getAppUrl({})).toThrow(/APP_URL is not set/)
  })
})
