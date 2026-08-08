const MENTION_REGEX = /@\[([a-zA-Z0-9\-_@.]+):([^\]]+)\]/g

export function extractMentionIds(body: string): string[] {
  if (!body) return []
  const ids: string[] = []
  const regex = new RegExp(MENTION_REGEX)
  let match: RegExpExecArray | null
  while ((match = regex.exec(body)) !== null) {
    if (match[1]) {
      ids.push(match[1])
    }
  }
  return Array.from(new Set(ids))
}

export type MentionToken = {
  fullMatch: string
  userId: string
  label: string
  index: number
}

export function parseMentionTokens(text: string): MentionToken[] {
  if (!text) return []
  const tokens: MentionToken[] = []
  const regex = new RegExp(MENTION_REGEX)
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      fullMatch: match[0],
      userId: match[1],
      label: match[2],
      index: match.index,
    })
  }
  return tokens
}
