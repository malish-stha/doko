'use client'

import type { Doc } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { PriorityPill } from './PriorityPill'

const TYPE_BADGE: Record<string, string> = {
  bug: 'bg-red-500/10 text-red-400 border-red-500/20',
  feature: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  task: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  epic: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
}

export function ActiveSprintPanel({
  sprint,
  tickets,
}: {
  sprint: Doc<'sprints'>
  tickets: Doc<'tickets'>[]
}) {
  const totalPts = tickets.reduce((s, t) => s + (t.storyPoints ?? 0), 0)
  const donePts = tickets
    .filter(t => t.status === 'done')
    .reduce((s, t) => s + (t.storyPoints ?? 0), 0)

  return (
    <div className="border border-teal-500/30 bg-card/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <span>{sprint.name}</span>
            <span className="text-[10px] px-2 py-0.5 font-mono font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30">
              ACTIVE SPRINT
            </span>
          </h3>
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          {tickets.length} tickets · <span className="font-semibold text-foreground">{donePts}/{totalPts} pts done</span>
        </div>
      </div>

      {tickets.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">
          No tickets in active sprint yet. Drag tickets from below into the sprint card above!
        </p>
      ) : (
        <div className="divide-y divide-border/40 border border-border/40 bg-background/50">
          {tickets.map(ticket => (
            <div
              key={ticket._id}
              className="flex items-center justify-between gap-3 p-2.5 hover:bg-muted/40 transition-colors text-xs"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="font-mono text-muted-foreground w-16 shrink-0">
                  {ticket.key}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 border font-mono uppercase tracking-wider ${
                    TYPE_BADGE[ticket.type] ?? ''
                  }`}
                >
                  {ticket.type}
                </span>
                <Link
                  href={`/tickets/${ticket.key}`}
                  className="font-medium truncate hover:text-teal-400 transition-colors"
                >
                  {ticket.title}
                </Link>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <PriorityPill priority={ticket.priority} />
                <span className="font-mono text-xs text-muted-foreground w-10 text-right">
                  {ticket.storyPoints != null ? `${ticket.storyPoints} pts` : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
