import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ConvexError } from "convex/values"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts a clean issue message from a Convex error or generic error.
 */
export function parseConvexError(err: unknown): string {
  if (!err) return 'An unexpected error occurred'
  if (err instanceof ConvexError) {
    const data = err.data
    if (typeof data === 'string') return data
    if (data && typeof data === 'object' && 'message' in data) return String((data as any).message)
  }
  const raw = err instanceof Error ? err.message : String(err)
  
  // Extract text after 'Server Error', strip [CONVEX...] headers and stack traces
  const parts = raw.split(/Server Error:?\s*/i)
  const main = parts[parts.length - 1]
    .split('\n')[0]
    .replace(/\[CONVEX[^\]]*\]/gi, '')
    .replace(/\[Request ID:[^\]]*\]/gi, '')
    .replace(/^Error:\s*/i, '')
    .trim()

  return main || 'An error occurred'
}

