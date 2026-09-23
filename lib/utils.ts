import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ConvexError } from "convex/values"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts a clean, user-facing message from a Convex error or generic error.
 * - ConvexError with a string payload: the string.
 * - ConvexError with `{ message }` (our authError shape): the message.
 * - Anything else: the server message with Convex's "[CONVEX M(...)] [Request ID: ...]
 *   Server Error Uncaught Error:" scaffolding stripped, all lines kept.
 */
export function parseConvexError(err: unknown): string {
  if (!err) return 'An unexpected error occurred'
  if (err instanceof ConvexError) {
    const data: unknown = err.data
    if (typeof data === 'string') return data
    if (data && typeof data === 'object' && 'message' in data) {
      return String((data as { message: unknown }).message)
    }
    return 'Request rejected'
  }

  const raw = err instanceof Error ? err.message : String(err)
  const afterServerError = raw.split(/Server Error:?\s*/i).pop() ?? raw
  const lines = afterServerError
    .split('\n')
    .map(line =>
      line
        .replace(/\[CONVEX[^\]]*\]/gi, '')
        .replace(/\[Request ID:[^\]]*\]/gi, '')
        .replace(/^\s*Uncaught\s+/i, '')
        .replace(/^\s*(Convex)?Error:\s*/i, '')
        .trim(),
    )
    // Drop stack frames and empty lines; keep every line of the actual message.
    .filter(line => line && !/^at\s|^\s*at\s|Called by client/.test(line))

  // A ConvexError serialised into the message: `{"code":"X","message":"..."}`.
  const jsonMatch = lines.join(' ').match(/\{"code":"[A-Z_]+","message":"((?:[^"\\]|\\.)*)"\}/)
  if (jsonMatch) return jsonMatch[1].replace(/\\"/g, '"')

  return lines.join(' ') || 'An error occurred'
}
