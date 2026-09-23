/** Helpers shared by email.ts; kept runtime-neutral so they can be unit-tested. */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escapes text for interpolation into HTML email bodies. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch])
}

/**
 * Public origin of the Next.js app, used to build links in emails. There is
 * deliberately no localhost fallback: a missing value throws so the scheduled
 * action fails visibly instead of emailing http://localhost links to users.
 */
export function getAppUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = env.APP_URL ?? env.NEXT_PUBLIC_APP_URL
  if (!raw) {
    throw new Error(
      'APP_URL is not set on the Convex deployment. Run: npx convex env set APP_URL https://your-app.example.com',
    )
  }
  return raw.replace(/\/+$/, '')
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
