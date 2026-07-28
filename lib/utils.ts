import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ConvexError } from "convex/values"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts a clean, user-friendly issue message from a Convex error or generic error object.
 */
export function parseConvexError(err: unknown): string {
  if (!err) return "An unexpected error occurred"

  // Check for ConvexError instance or .data payload
  if (err instanceof ConvexError) {
    if (typeof err.data === "string") return cleanMessageString(err.data)
    if (
      typeof err.data === "object" &&
      err.data !== null &&
      "message" in err.data &&
      typeof (err.data as any).message === "string"
    ) {
      return cleanMessageString((err.data as any).message)
    }
    if (err.data) return String(err.data)
  }

  if (typeof err === "object" && err !== null && "data" in err && typeof (err as any).data === "string") {
    return cleanMessageString((err as any).data)
  }

  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : String(err)
  return cleanMessageString(raw)
}

function cleanMessageString(raw: string): string {
  if (!raw) return "An unexpected error occurred"

  // Strip Convex system headers: [CONVEX M(module:func)] [Request ID: xxx]
  let message = raw
    .replace(/\[CONVEX\s+[^\]]+\]/gi, "")
    .replace(/\[Request ID:\s*[^\]]+\]/gi, "")
    .trim()

  // Clean prefix keywords
  let previous = ""
  while (message !== previous) {
    previous = message
    message = message
      .replace(/^\[ConvexError.*?\]\s*/i, "")
      .replace(/^Uncaught\s+/i, "")
      .replace(/^ConvexError:\s*/i, "")
      .replace(/^Server\s+Error:\s*/i, "")
      .replace(/^Server\s+Error\s*/i, "")
      .replace(/^Error:\s*/i, "")
      .trim()
  }

  // Take the first line of actual message content, skipping stack trace lines
  const lines = message.split("\n").map(l => l.trim()).filter(Boolean)
  let primaryLine = lines.find(line => line && !line.startsWith("at ") && !line.includes("Called function")) || lines[0] || ""

  // Clean prefix again if primaryLine contained prefix
  previous = ""
  while (primaryLine !== previous) {
    previous = primaryLine
    primaryLine = primaryLine
      .replace(/^\[ConvexError.*?\]\s*/i, "")
      .replace(/^Uncaught\s+/i, "")
      .replace(/^ConvexError:\s*/i, "")
      .replace(/^Server\s+Error:\s*/i, "")
      .replace(/^Server\s+Error\s*/i, "")
      .replace(/^Error:\s*/i, "")
      .trim()
  }

  // Remove trailing internal call metadata
  primaryLine = primaryLine
    .replace(/\s+\(called function .*\)$/i, "")
    .replace(/\s+at\s+.*$/i, "")
    .trim()

  return primaryLine || "Server Error"
}

