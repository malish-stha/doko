'use client'

import { useQuery } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { formatDistanceToNow } from 'date-fns'
import { CommentForm } from './CommentForm'
import { StartDMButton } from '@/components/chat/StartDMButton'
import { MessageSquareIcon } from 'lucide-react'

export function CommentThread({ ticketId }: { ticketId: Id<'tickets'> }) {
  const { data: session } = useSession()
  const currentEmail = (session?.user?.email ?? '').trim().toLowerCase()
  const comments = useQuery(api.comments.byTicket, { ticketId }) ?? []

  return (
    <div className="mt-8 border-t pt-6">
      <div className="text-xs font-medium uppercase text-muted-foreground mb-4 flex items-center gap-1.5">
        <MessageSquareIcon className="w-3.5 h-3.5" />
        Comments ({comments.length})
      </div>

      <div className="space-y-3 mb-6">
        {comments.length > 0 ? (
          comments.map(c => (
            <div key={c._id} className="border bg-card p-3 rounded-none text-sm space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-foreground/80">{c.authorId}</span>
                  {c.authorId && c.authorId !== currentEmail && (
                    <StartDMButton userId={c.authorId} label="DM" size="xs" />
                  )}
                </div>
                <span className="text-[11px]">{formatDistanceToNow(new Date(c.createdAt))} ago</span>
              </div>
              <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
                {c.body}
              </div>
            </div>
          ))
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
