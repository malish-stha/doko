'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { TicketCard } from './TicketCard'
import { AlertTriangleIcon } from 'lucide-react'

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
  wipLimit,
  customLabel,
  focusedTicketId,
  selectedIds,
  onCardClick,
  onCardSelectToggle,
}: {
  status: Doc<'tickets'>['status']
  tickets: Doc<'tickets'>[]
  wipLimit?: number
  customLabel?: string
  focusedTicketId?: Id<'tickets'> | null
  selectedIds?: Set<Id<'tickets'>>
  onCardClick?: (id: Id<'tickets'>) => void
  onCardSelectToggle?: (id: Id<'tickets'>) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  const isOverWip = wipLimit !== undefined && wipLimit > 0 && tickets.length > wipLimit
  const label = customLabel ?? STATUS_LABELS[status] ?? status

  return (
    <div className="flex flex-col min-w-[260px] flex-1">
      <div
        className={`flex items-center justify-between text-xs font-medium uppercase tracking-wider mb-2 px-1 ${
          isOverWip ? 'text-red-400 font-semibold' : 'text-muted-foreground'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isOverWip && <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          <span className="truncate">{label}</span>
        </div>
        <span className={`font-mono text-[11px] shrink-0 ${isOverWip ? 'text-red-400 font-bold' : 'text-muted-foreground/60'}`}>
          {wipLimit ? `(${tickets.length} / ${wipLimit})` : `(${tickets.length})`}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 p-2 border transition-colors ${
          isOver
            ? 'border-teal-500 border-solid bg-teal-500/5'
            : isOverWip
            ? 'border-red-500/30 bg-red-500/5'
            : 'border-dashed border-border/50 bg-muted/20'
        } min-h-[220px]`}
      >
        {tickets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/40 font-mono">
            Drop here
          </div>
        ) : (
          tickets.map(t => (
            <TicketCard
              key={t._id}
              ticket={t}
              focused={focusedTicketId === t._id}
              selected={selectedIds?.has(t._id)}
              onClick={() => onCardClick?.(t._id)}
              onSelectToggle={() => onCardSelectToggle?.(t._id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
