'use client'

import { useDraggable } from '@dnd-kit/core'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { UserCheckIcon, CheckSquareIcon } from 'lucide-react'

const PRIORITY_BAR: Record<string, string> = {
  low: 'bg-muted-foreground/40',
  medium: 'bg-blue-400',
  high: 'bg-orange-400',
  urgent: 'bg-red-500 shadow-sm shadow-red-500/50',
}

const TYPE_BADGE: Record<string, string> = {
  bug: 'bg-red-500/10 text-red-400 border-red-500/20',
  feature: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  task: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  epic: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
}

export function TicketCard({
  ticket,
  focused,
  selected,
  onSelectToggle,
  onClick,
}: {
  ticket: Doc<'tickets'>
  focused?: boolean
  selected?: boolean
  onSelectToggle?: (e: React.MouseEvent) => void
  onClick?: (e: React.MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: ticket._id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const linksData = useQuery(api.ticketLinks.forTicket, { ticketId: ticket._id }) ?? []
  const isBlocked = linksData.some(
    ({ link, target }) => link.type === 'blocked_by' && target && target.status !== 'done',
  )

  const assigneeLabel = ticket.assigneeId
    ? ticket.assigneeId.includes('@')
      ? ticket.assigneeId.split('@')[0]
      : ticket.assigneeId.slice(0, 10)
    : null

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey && onSelectToggle) {
      e.stopPropagation()
      onSelectToggle(e)
    } else if (onClick) {
      onClick(e)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-ticket-id={ticket._id}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`relative flex border cursor-grab hover:border-teal-500/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ease-out select-none rounded-none overflow-hidden ${
        selected
          ? 'bg-teal-500/15 border-teal-500/70 shadow-sm'
          : 'bg-card/90 border-border/80'
      } ${focused ? 'ring-2 ring-teal-400 z-20 shadow-md' : ''} ${
        isDragging ? 'opacity-40 z-50 shadow-xl scale-105' : ''
      }`}
    >
      <div className={`w-1 shrink-0 ${PRIORITY_BAR[ticket.priority] ?? 'bg-blue-400'}`} />
      <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              {selected && (
                <CheckSquareIcon className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              )}
              <Link
                href={`/tickets/${ticket.key}`}
                className="text-xs font-mono tabular-nums text-muted-foreground hover:text-foreground transition-colors hover:underline"
                onClick={e => e.stopPropagation()}
              >
                {ticket.key}
              </Link>
              {isBlocked && (
                <span title="Blocked by an unresolved ticket" className="text-xs text-red-400">
                  🚫
                </span>
              )}
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 border font-medium uppercase tracking-wider font-mono ${
                TYPE_BADGE[ticket.type] ?? ''
              }`}
            >
              {ticket.type}
            </span>
          </div>

          <Link
            href={`/tickets/${ticket.key}`}
            className="block text-sm font-medium leading-snug line-clamp-2 hover:text-teal-400 transition-colors mb-2"
            onClick={e => e.stopPropagation()}
          >
            {ticket.title}
          </Link>
        </div>

        {assigneeLabel && (
          <div className="flex items-center justify-end mt-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 border border-teal-500/30 text-teal-400 bg-teal-500/10">
              <UserCheckIcon className="w-2.5 h-2.5" />
              {assigneeLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
