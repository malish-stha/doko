'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Doc } from '@/convex/_generated/dataModel'
import { TicketCard } from './TicketCard'

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
}

export function KanbanColumn({
  status,
  tickets,
}: {
  status: Doc<'tickets'>['status']
  tickets: Doc<'tickets'>[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex flex-col min-w-[260px] flex-1">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 px-1">
        <span>{STATUS_LABELS[status]}</span>
        <span className="text-muted-foreground/60 font-mono text-[11px]">
          ({tickets.length})
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 p-2 border transition-colors ${
          isOver
            ? 'border-teal-500 border-solid bg-teal-500/5'
            : 'border-dashed border-border/50 bg-muted/20'
        } min-h-[220px]`}
      >
        {tickets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/40 font-mono">
            Drop here
          </div>
        ) : (
          tickets.map(t => <TicketCard key={t._id} ticket={t} />)
        )}
      </div>
    </div>
  )
}
