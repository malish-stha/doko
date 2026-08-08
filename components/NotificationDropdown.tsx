'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { BellIcon, CheckCheckIcon, InboxIcon, ArrowRightIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { UserAvatar } from './UserAvatar'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'

export function NotificationDropdown() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined

  const [open, setOpen] = useState(false)
  const unreadCount = useQuery(api.mentions.unreadCount, userEmail ? { userEmail } : 'skip') ?? 0
  const mentions = useQuery(api.mentions.forMe, open && userEmail ? { userEmail } : 'skip') ?? []

  const markRead = useMutation(api.mentions.markRead)
  const markAllRead = useMutation(api.mentions.markAllRead)

  const handleMarkRead = async (id: Id<'mentions'>) => {
    try {
      await markRead({ mentionId: id, userEmail })
    } catch (err: any) {
      toast.error('Failed to mark read', parseConvexError(err))
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllRead({ userEmail })
      toast.success('All notifications marked as read')
    } catch (err: any) {
      toast.error('Failed to mark all read', parseConvexError(err))
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative p-2 rounded-none text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer flex items-center justify-center">
        <BellIcon className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-mono font-bold bg-teal-500 text-slate-950 rounded-full animate-in zoom-in-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent className="w-80 sm:w-96 p-0 bg-background border-border shadow-2xl z-50 font-sans" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <BellIcon className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-mono bg-teal-500/20 text-teal-400 px-1.5 py-0.2">
                {unreadCount} new
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[11px] font-mono text-muted-foreground hover:text-teal-400 flex items-center gap-1 transition-colors"
            >
              <CheckCheckIcon className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
          {mentions.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <InboxIcon className="w-6 h-6 text-muted-foreground/60 mx-auto" />
              <div className="text-xs text-muted-foreground">No recent notifications</div>
            </div>
          ) : (
            mentions.slice(0, 10).map(m => {
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
                  className={`p-3 text-xs transition-colors flex items-start gap-2.5 ${
                    isUnread ? 'bg-teal-500/5 hover:bg-teal-500/10' : 'bg-transparent hover:bg-muted/30 opacity-80'
                  }`}
                >
                  <UserAvatar name={m.authorName} avatarUrl={m.authorAvatar} className="w-7 h-7 shrink-0 mt-0.5" />

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <span className="font-semibold text-foreground truncate">{m.authorName}</span>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {formatDistanceToNow(m.createdAt, { addSuffix: true })}
                      </span>
                    </div>

                    <p className="text-muted-foreground text-[11px] leading-tight">
                      {m.contextRefType === 'comment'
                        ? 'mentioned you in a comment'
                        : m.contextRefType === 'message'
                        ? 'mentioned you in chat'
                        : 'updated a ticket you are watching'}
                    </p>

                    {m.contextDetail && (
                      <Link
                        href={targetUrl}
                        onClick={() => {
                          if (isUnread) handleMarkRead(m._id)
                          setOpen(false)
                        }}
                        className="block p-1.5 bg-muted/40 border border-border/40 hover:border-teal-500/40 transition-colors rounded-none mt-1"
                      >
                        {m.contextDetail.ticketKey && (
                          <div className="font-mono text-teal-400 font-bold text-[11px] truncate">
                            {m.contextDetail.ticketKey} — {m.contextDetail.ticketTitle}
                          </div>
                        )}
                        {m.contextDetail.commentBody && (
                          <div className="text-[11px] text-muted-foreground line-clamp-1 italic">
                            "{m.contextDetail.commentBody}"
                          </div>
                        )}
                      </Link>
                    )}
                  </div>

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(m._id)}
                      className="text-muted-foreground hover:text-teal-400 p-0.5 transition-colors shrink-0"
                      title="Mark read"
                    >
                      <CheckCheckIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-border bg-muted/20 text-center">
          <Link
            href="/inbox"
            onClick={() => setOpen(false)}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-mono text-teal-400 hover:underline py-1"
          >
            <span>View all in Inbox</span>
            <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
