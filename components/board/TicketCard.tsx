'use client'

import { useDraggable } from '@dnd-kit/core'
import type { Doc } from '@/convex/_generated/dataModel'
import Link from 'next/link'

const PRIORITY_BAR: Record<string, string> = {
  low: 'bg-muted-foreground/40',
  medium: 'bg-blue-400',
  high: 'bg-orange-400',
  urgent: 'bg-red-500',
}

const TYPE_BADGE: Record<string, string> = {
  bug: 'bg-red-500/10 text-red-400 border-red-500/20',
  feature: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  task: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  epic: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
}

export function TicketCard({ ticket }: { ticket: Doc<'tickets'> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: ticket._id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex bg-card border border-border cursor-grab hover:border-teal-500/50 transition-colors select-none ${
        isDragging ? 'opacity-40 z-50 shadow-lg' : ''
      }`}
    >
      <div className={`w-1 shrink-0 ${PRIORITY_BAR[ticket.priority] ?? 'bg-blue-400'}`} />
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <Link
            href={`/tickets/${ticket.key}`}
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors hover:underline"
            onClick={e => e.stopPropagation()}
          >
            {ticket.key}
          </Link>
          <span
            className={`text-[10px] px-1.5 py-0.5 border font-medium uppercase tracking-wider ${
              TYPE_BADGE[ticket.type] ?? ''
            }`}
          >
            {ticket.type}
          </span>
        </div>
        <Link
          href={`/tickets/${ticket.key}`}
          className="block text-sm font-medium leading-snug line-clamp-2 hover:text-teal-400 transition-colors"
          onClick={e => e.stopPropagation()}
        >
          {ticket.title}
        </Link>
      </div>
    </div>
  )
}
