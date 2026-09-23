/**
 * Mention syntax: `@[userId:Label]`. userIds are canonical membership ids
 * (lowercased emails) but legacy rows may carry OIDC subjects such as
 * `google-oauth2|1234`, so the id class allows `|`, `+`, `%` and `~` too.
 * `:` and `]` stay reserved as delimiters.
 */
const ID_CLASS = String.raw`[a-zA-Z0-9\-_@.|+%~]+`
const MENTION_REGEX = new RegExp(String.raw`@\[(${ID_CLASS}):([^\]]+)\]`, 'g')

/** Inline code spans and fenced blocks never contain live mentions. */
function stripCode(text: string) {
  return text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ')
}

export function extractMentionIds(body: string): string[] {
  if (!body) return []
  const ids = new Set<string>()
  const regex = new RegExp(MENTION_REGEX.source, 'g')
  let match: RegExpExecArray | null
  const haystack = stripCode(body)
  while ((match = regex.exec(haystack)) !== null) {
    if (match[1]) ids.add(match[1])
  }
  return Array.from(ids)
}

export type MentionToken = {
  fullMatch: string
  userId: string
  label: string
  index: number
}

/**
 * Every mention token with its position, for rendering. Tokens inside code
 * spans are skipped so rendering and extraction agree on what is a mention.
 */
export function parseMentionTokens(text: string): MentionToken[] {
  if (!text) return []
  const tokens: MentionToken[] = []
  const codeRanges: Array<[number, number]> = []
  for (const re of [/```[\s\S]*?```/g, /`[^`\n]*`/g]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) codeRanges.push([m.index, m.index + m[0].length])
  }
  const inCode = (i: number) => codeRanges.some(([s, e]) => i >= s && i < e)

  const regex = new RegExp(MENTION_REGEX.source, 'g')
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (inCode(match.index)) continue
    tokens.push({
      fullMatch: match[0],
      userId: match[1],
      label: match[2],
      index: match.index,
    })
  }
  return tokens
}
