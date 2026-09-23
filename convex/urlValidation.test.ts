import { describe, expect, test } from 'vitest'
import { validateAvatarUrl, validateGithubUrl, validateLinkedinUrl } from './urlValidation'

describe('profile URL validation', () => {
  test('accepts https URLs on allowed hosts', () => {
    expect(validateAvatarUrl('https://api.dicebear.com/9.x/thumbs/svg?seed=x')).toContain('dicebear')
    expect(validateGithubUrl('https://github.com/octocat')).toBe('https://github.com/octocat')
    expect(validateLinkedinUrl('https://www.linkedin.com/in/octocat/')).toContain('linkedin.com')
  })

  test('rejects javascript:, http:, credentials and unknown hosts', () => {
    expect(() => validateAvatarUrl('javascript:alert(1)')).toThrow(/https/)
    expect(() => validateAvatarUrl('http://api.dicebear.com/x.svg')).toThrow(/https/)
    expect(() => validateAvatarUrl('https://user:pw@api.dicebear.com/x.svg')).toThrow(/credentials/)
    expect(() => validateAvatarUrl('https://tracker.example.com/pixel.gif')).toThrow(/hosted on/)
    expect(() => validateGithubUrl('https://github.com.evil.com/x')).toThrow(/github.com/)
    expect(() => validateLinkedinUrl('https://example.com')).toThrow(/linkedin.com/)
    expect(() => validateGithubUrl('not a url')).toThrow(/valid URL/)
  })
})
