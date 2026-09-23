/**
 * Only same-origin, relative paths are allowed as post-login destinations.
 * Rejects protocol-relative (`//evil`), absolute URLs and backslash tricks.
 */
export function safeRedirectPath(candidate: string | null | undefined, fallback = '/home') {
  if (!candidate) return fallback
  const hasBackslash = candidate.indexOf('\\') !== -1
  if (!candidate.startsWith('/') || candidate.startsWith('//') || hasBackslash) {
    return fallback
  }
  return candidate
}
