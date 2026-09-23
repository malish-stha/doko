'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { formatDistanceToNow } from 'date-fns'
import { CommentForm } from './CommentForm'
import { StartDMButton } from '@/components/chat/StartDMButton'
import { UserAvatar } from '@/components/UserAvatar'
import { MessageSquareIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'
import { MentionBadge } from '@/components/mentions/MentionBadge'


export function CommentThread({ ticketId }: { ticketId: Id<'tickets'> }) {
  const { data: session } = useSession()
  const currentEmail = (session?.user?.email ?? '').trim().toLowerCase()
  const comments = useQuery(api.comments.byTicket, { ticketId }) ?? []
  const editComment = useMutation(api.comments.edit)
  const removeComment = useMutation(api.comments.remove)
  const [editingId, setEditingId] = useState<Id<'comments'> | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const saveEdit = async () => {
    if (!editingId || !draft.trim() || saving) return
    setSaving(true)
    try {
      await editComment({ commentId: editingId, body: draft })
      setEditingId(null)
    } catch (err) {
      toast.error('Could not edit comment', parseConvexError(err))
    } finally {
      setSaving(false)
    }
  }

  const deleteComment = async (commentId: Id<'comments'>) => {
    if (!confirm('Delete this comment?')) return
    try {
      await removeComment({ commentId })
    } catch (err) {
      toast.error('Could not delete comment', parseConvexError(err))
    }
  }

  return (
    <div className="mt-8 border-t pt-6">
      <div className="text-xs font-medium uppercase text-muted-foreground mb-4 flex items-center gap-1.5">
        <MessageSquareIcon className="w-3.5 h-3.5" />
        Comments ({comments.length})
      </div>

      <div className="space-y-3 mb-6">
        {comments.length > 0 ? (
          comments.map(c => {
            const authorUserId = c.authorUserId ?? c.authorId
            const authorEmail = (c.authorEmail ?? '').trim().toLowerCase()
            const isMe = authorEmail === currentEmail || authorUserId === currentEmail

            return (
              <div key={c._id} className="border bg-card p-3 rounded-none text-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar
                      user={{
                        avatarUrl: c.avatarUrl,
                        name: c.authorName,
                        email: c.authorEmail,
                        userId: authorUserId,
                      }}
                      seed={authorEmail || authorUserId || c._id}
                      size="sm"
                    />
                    <span className="font-mono font-medium text-foreground/90">
                      {c.authorName || c.authorId}
                    </span>
                    {!isMe && authorUserId && (
                      <StartDMButton userId={authorUserId} label="DM" size="xs" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]">
                      {formatDistanceToNow(new Date(c.createdAt))} ago
                      {c.editedAt && <span className="ml-1 opacity-70">(edited)</span>}
                    </span>
                    {c.canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c._id)
                          setDraft(c.body)
                        }}
                        className="p-1 hover:text-foreground transition-colors"
                        aria-label="Edit comment"
                        title="Edit comment"
                      >
                        <PencilIcon className="w-3 h-3" />
                      </button>
                    )}
                    {c.canDelete && (
                      <button
                        type="button"
                        onClick={() => deleteComment(c._id)}
                        className="p-1 hover:text-red-400 transition-colors"
                        aria-label="Delete comment"
                        title="Delete comment"
                      >
                        <Trash2Icon className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                {editingId === c._id ? (
                  <div className="pl-9 space-y-2">
                    <Textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} autoFocus />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-teal-500 hover:bg-teal-400 text-black"
                        disabled={!draft.trim() || saving}
                        onClick={saveEdit}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed pl-9">
                    {renderFormattedComment(c.body)}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="text-xs text-muted-foreground/60 italic py-2">
            No comments yet. Start the conversation below.
          </div>
        )}
      </div>

      <CommentForm ticketId={ticketId} />
    </div>
  )
}

function renderFormattedComment(text: string) {

  const lines = text.split('\n')
  return lines.map((line, idx) => {
    if (line.startsWith('- ')) {
      return (
        <div key={idx} className="flex items-center gap-2 text-foreground/90 pl-2">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
          <span>{parseInlineMarkdown(line.replace('- ', ''))}</span>
        </div>
      )
    }
    return <div key={idx}>{parseInlineMarkdown(line)}</div>
  })
}

function parseInlineMarkdown(text: string) {
  const mentionParts = text.split(/(@\[[a-zA-Z0-9\-_@.]+:.*?\])/g)
  return mentionParts.map((part, index) => {
    const mentionMatch = /@\[([a-zA-Z0-9\-_@.]+):(.*?)]/.exec(part)
    if (mentionMatch) {
      const [, userId, label] = mentionMatch
      return <MentionBadge key={index} userId={userId} label={label} />
    }

    const parts = part.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g)
    return parts.map((sub, i) => {
      if (sub.startsWith('**') && sub.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-foreground">
            {sub.slice(2, -2)}
          </strong>
        )
      }
      if (sub.startsWith('*') && sub.endsWith('*')) {
        return (
          <em key={i} className="italic text-teal-300">
            {sub.slice(1, -1)}
          </em>
        )
      }
      if (sub.startsWith('`') && sub.endsWith('`')) {
        return (
          <code key={i} className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border border-border">
            {sub.slice(1, -1)}
          </code>
        )
      }
      return sub
    })
  })
}

