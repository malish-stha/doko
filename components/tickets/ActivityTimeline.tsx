'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { formatDistanceToNow } from 'date-fns'
import { renderEventSentence } from '@/lib/renderEvent'
import { UserAvatar } from '@/components/UserAvatar'
import { HistoryIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

function getDotColor(kind: string): string {
  if (kind.includes('done') || kind.includes('checked')) return 'bg-emerald-400'
  if (kind.includes('comment')) return 'bg-amber-400'
  if (kind.includes('blocked') || kind.includes('removed') || kind.includes('delete')) return 'bg-red-400'
  if (kind.includes('subtask') || kind.includes('attach')) return 'bg-teal-400'
  return 'bg-blue-400'
}

export function ActivityTimeline({
  ticketId,
  userEmail,
}: {
  ticketId: Id<'tickets'>
  userEmail?: string
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const data = useQuery(api.events.forTicket, { ticketId, page, pageSize, userEmail })

  const events = data?.events ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, totalCount)

  return (
    <div className="space-y-4 pt-6 border-t border-border/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <HistoryIcon className="w-4 h-4 text-teal-400" />
          <span>Activity History ({totalCount})</span>
        </div>

        {totalCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground">Per page:</span>
            {[5, 10, 25].map(size => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setPageSize(size)
                  setPage(1)
                }}
                className={`text-[11px] font-mono px-1.5 py-0.5 border transition-colors ${
                  pageSize === size
                    ? 'border-teal-400 text-teal-400 font-bold bg-teal-500/10'
                    : 'border-border/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-xs text-muted-foreground italic py-2">No activity recorded yet</div>
      ) : (
        <div className="relative pl-4 space-y-4 border-l border-border/40 ml-2">
          {events.map(event => {
            const dotColor = getDotColor(event.kind)
            const sentence = renderEventSentence(event)

            return (
              <div key={event._id} className="relative group text-xs flex items-start gap-3">
                {/* Colored dot on timeline */}
                <div
                  className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ${dotColor} ring-4 ring-background`}
                />

                <UserAvatar
                  name={event.userName}
                  avatarUrl={event.avatarUrl}
                  email={event.userEmail}
                  className="w-5 h-5 shrink-0 mt-0.5"
                />

                <div className="flex-1 min-w-0">
                  <div className="text-foreground">{sentence}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(event.ts, { addSuffix: true })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-border/20 text-xs">
          <div className="text-[11px] font-mono text-muted-foreground">
            Showing {startItem}-{endItem} of {totalCount}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="h-7 text-xs px-2 gap-1 border-border/60"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
              <span>Previous</span>
            </Button>

            <span className="text-[11px] font-mono px-2 text-muted-foreground">
              Page {page} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="h-7 text-xs px-2 gap-1 border-border/60"
            >
              <span>Next</span>
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
