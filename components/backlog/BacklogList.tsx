'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Doc } from '@/convex/_generated/dataModel'
import { BacklogTicketRow } from './BacklogTicketRow'

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
}

export function BacklogList({ tickets }: { tickets: Doc<'tickets'>[] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'backlog',
  })

  const sortedTickets = [...tickets].sort((a, b) => {
    const priA = PRIORITY_ORDER[a.priority] ?? 0
    const priB = PRIORITY_ORDER[b.priority] ?? 0
    if (priA !== priB) return priB - priA
    return b.createdAt - a.createdAt
  })

  const totalPoints = tickets.reduce(
    (sum, t) => sum + (t.storyPoints ?? 0),
    0,
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
          Backlog Pile ({tickets.length})
        </h2>
        <span className="text-xs font-mono text-muted-foreground">
          Total estimated: <strong className="text-foreground font-semibold">{totalPoints} pts</strong>
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`border transition-all duration-150 min-h-[160px] bg-card/40 ${
          isOver
            ? 'border-teal-500 bg-teal-500/5 ring-1 ring-teal-500/30'
            : 'border-border/80'
        }`}
      >
        {sortedTickets.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No unassigned tickets in the backlog. Drag tickets back here from a sprint or create new tickets!
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {sortedTickets.map(ticket => (
              <BacklogTicketRow key={ticket._id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
