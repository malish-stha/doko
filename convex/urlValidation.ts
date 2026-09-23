import { ConvexError } from 'convex/values'

/**
 * Profile links are rendered as <a href> / <img src> for other users, so
 * only https URLs on known hosts are accepted. Anything else is rejected
 * with a user-facing message.
 */

export const AVATAR_HOSTS = [
  'api.dicebear.com',
  'lh3.googleusercontent.com',
  'avatars.githubusercontent.com',
  'secure.gravatar.com',
  'www.gravatar.com',
]

const GITHUB_HOSTS = ['github.com', 'www.github.com']
const LINKEDIN_HOSTS = ['linkedin.com', 'www.linkedin.com']

function parseHttps(value: string, label: string): URL {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new ConvexError({ code: 'INVALID_URL', message: `${label} must be a valid URL.` })
  }
  if (url.protocol !== 'https:') {
    throw new ConvexError({ code: 'INVALID_URL', message: `${label} must start with https://.` })
  }
  if (url.username || url.password) {
    throw new ConvexError({ code: 'INVALID_URL', message: `${label} must not contain credentials.` })
  }
  return url
}

function hostAllowed(url: URL, hosts: readonly string[]) {
  const host = url.hostname.toLowerCase()
  return hosts.some(h => host === h || host.endsWith(`.${h}`))
}

export function validateAvatarUrl(value: string): string {
  const url = parseHttps(value, 'Avatar URL')
  if (!hostAllowed(url, AVATAR_HOSTS)) {
    throw new ConvexError({
      code: 'INVALID_URL',
      message: `Avatar images must be hosted on one of: ${AVATAR_HOSTS.join(', ')}.`,
    })
  }
  return url.toString()
}

export function validateGithubUrl(value: string): string {
  const url = parseHttps(value, 'GitHub URL')
  if (!hostAllowed(url, GITHUB_HOSTS)) {
    throw new ConvexError({ code: 'INVALID_URL', message: 'GitHub URL must point to github.com.' })
  }
  return url.toString()
}

export function validateLinkedinUrl(value: string): string {
  const url = parseHttps(value, 'LinkedIn URL')
  if (!hostAllowed(url, LINKEDIN_HOSTS)) {
    throw new ConvexError({ code: 'INVALID_URL', message: 'LinkedIn URL must point to linkedin.com.' })
  }
  return url.toString()
}
