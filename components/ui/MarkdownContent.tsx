'use client'

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { parseMentionTokens } from '@/lib/mentions'
import { MentionBadge } from '@/components/mentions/MentionBadge'
import { cn } from '@/lib/utils'

/** Mentions are encoded as links on a reserved host so they survive sanitisation. */
const MENTION_HOST = 'https://mention.doko.invalid/'

function encodeMentions(text: string) {
  const tokens = parseMentionTokens(text)
  if (tokens.length === 0) return text
  let out = ''
  let cursor = 0
  for (const t of tokens) {
    out += text.slice(cursor, t.index)
    out += `[@${t.label.replace(/[\[\]]/g, '')}](${MENTION_HOST}${encodeURIComponent(t.userId)})`
    cursor = t.index + t.fullMatch.length
  }
  return out + text.slice(cursor)
}

const components: Components = {
  a: ({ href, children, ...rest }) => {
    if (href?.startsWith(MENTION_HOST)) {
      const userId = decodeURIComponent(href.slice(MENTION_HOST.length))
      const label = String(Array.isArray(children) ? children.join('') : children ?? '').replace(/^@/, '')
      return <MentionBadge userId={userId} label={label} />
    }
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" {...rest}>
        {children}
      </a>
    )
  },
}

/**
 * The one Markdown renderer for descriptions, comments and rich-text
 * previews: GitHub-flavoured Markdown, sanitised HTML, theme-aware
 * typography, and @mentions rendered as badges.
 */
export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none break-words', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
        {encodeMentions(content)}
      </ReactMarkdown>
    </div>
  )
}
