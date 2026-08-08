'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { UserAvatar } from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import { BellIcon, CheckCheckIcon, InboxIcon } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'

export default function InboxPage() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined

  const [filter, setFilter] = useState<'unread' | 'all'>('unread')
  const readFilter = filter === 'unread' ? false : undefined

  const mentions = useQuery(api.mentions.forMe, { read: readFilter, userEmail }) ?? []
  const markRead = useMutation(api.mentions.markRead)
  const markAllRead = useMutation(api.mentions.markAllRead)

  const handleMarkRead = async (id: Id<'mentions'>) => {
    try {
      await markRead({ mentionId: id, userEmail })
    } catch (err: any) {
      toast.error('Failed to mark notification as read', parseConvexError(err))
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllRead({ userEmail })
      toast.success('All notifications marked as read')
    } catch (err: any) {
      toast.error('Failed to mark all as read', parseConvexError(err))
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <BellIcon className="w-5 h-5 text-teal-400" />
          <h1 className="text-xl font-bold tracking-tight">Inbox Notifications</h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllRead}
          className="text-xs gap-1.5 border-border/60"
        >
          <CheckCheckIcon className="w-3.5 h-3.5" />
          <span>Mark all read</span>
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
            filter === 'unread'
              ? 'border-teal-400 text-teal-400 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Unread
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
            filter === 'all'
              ? 'border-teal-400 text-teal-400 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
      </div>

      {mentions.length === 0 ? (
        <div className="text-center py-12 space-y-3 bg-card/30 border border-border/40 p-8">
          <InboxIcon className="w-8 h-8 text-muted-foreground mx-auto" />
          <div className="text-sm font-medium">No notifications</div>
          <p className="text-xs text-muted-foreground">
            {filter === 'unread'
              ? "You're all caught up! No unread mentions."
              : 'No notification history yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {mentions.map(m => {
            const isUnread = !m.read
            const targetUrl =
              m.contextDetail?.ticketKey
                ? `/board?ticket=${m.contextDetail.ticketKey}`
                : m.contextDetail?.key
                ? `/board?ticket=${m.contextDetail.key}`
                : m.contextDetail?.channelId
                ? `/chat`
                : '/board'

            return (
              <div
                key={m._id}
                className={`flex items-start gap-4 p-4 border transition-colors ${
                  isUnread
                    ? 'bg-teal-500/5 border-teal-500/30'
                    : 'bg-card/40 border-border/40 opacity-80'
                }`}
              >
                <UserAvatar
                  name={m.authorName}
                  avatarUrl={m.authorAvatar}
                  className="w-8 h-8 shrink-0 mt-0.5"
                />

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="text-xs flex items-center gap-2">
                    <span className="font-semibold text-foreground">{m.authorName}</span>
                    <span className="text-muted-foreground">
                      {m.contextRefType === 'comment'
                        ? 'mentioned you in a comment'
                        : m.contextRefType === 'message'
                        ? 'mentioned you in chat'
                        : 'updated a ticket you are watching'}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                      {formatDistanceToNow(m.createdAt, { addSuffix: true })}
                    </span>
                  </div>

                  {m.contextDetail && (
                    <Link
                      href={targetUrl}
                      onClick={() => {
                        if (isUnread) handleMarkRead(m._id)
                      }}
                      className="block p-2 bg-background/60 border border-border/60 hover:border-teal-500/50 transition-colors text-xs font-mono"
                    >
                      {m.contextDetail.ticketKey && (
                        <div className="text-teal-400 font-bold mb-0.5">
                          {m.contextDetail.ticketKey} — {m.contextDetail.ticketTitle}
                        </div>
                      )}
                      {m.contextDetail.key && (
                        <div className="text-teal-400 font-bold mb-0.5">
                          {m.contextDetail.key} — {m.contextDetail.title}
                        </div>
                      )}
                      {m.contextDetail.commentBody && (
                        <div className="text-muted-foreground line-clamp-2 italic">
                          "{m.contextDetail.commentBody}"
                        </div>
                      )}
                      {m.contextDetail.messageBody && (
                        <div className="text-muted-foreground line-clamp-2 italic">
                          "{m.contextDetail.messageBody}"
                        </div>
                      )}
                    </Link>
                  )}
                </div>

                {isUnread && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkRead(m._id)}
                    className="text-xs text-muted-foreground hover:text-teal-400 shrink-0"
                    title="Mark as read"
                  >
                    <CheckCheckIcon className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
