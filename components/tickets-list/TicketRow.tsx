'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import type { Doc } from '@/convex/_generated/dataModel'
import { UserCheckIcon } from 'lucide-react'

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-muted/40 text-muted-foreground border-border/40',
  medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-400 border-red-500/20 font-bold',
}

const STATUS_BADGE: Record<string, string> = {
  backlog: 'bg-muted/40 text-muted-foreground border-border/40',
  todo: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  review: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  done: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
}

export function TicketRow({
  ticket,
  selected,
  visibleCols,
  onSelectToggle,
}: {
  ticket: Doc<'tickets'>
  selected?: boolean
  visibleCols: Record<string, boolean>
  onSelectToggle: (e: React.MouseEvent) => void
}) {
  const assigneeLabel = ticket.assigneeId
    ? ticket.assigneeId.includes('@')
      ? ticket.assigneeId.split('@')[0]
      : ticket.assigneeId.slice(0, 10)
    : null

  return (
    <tr
      onClick={onSelectToggle}
      className={`border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer select-none ${
        selected ? 'bg-teal-500/10 hover:bg-teal-500/15' : ''
      }`}
    >
      <td className="p-3 w-10 text-center" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={e => onSelectToggle(e as any)}
          className="rounded border-border text-teal-500 focus:ring-teal-400 h-4 w-4 cursor-pointer"
        />
      </td>

      {visibleCols.key && (
        <td className="p-3 font-mono text-xs font-semibold">
          <Link
            href={`/tickets/${ticket.key}`}
            className="text-muted-foreground hover:text-teal-400 transition-colors hover:underline"
            onClick={e => e.stopPropagation()}
          >
            {ticket.key}
          </Link>
        </td>
      )}

      {visibleCols.type && (
        <td className="p-3 text-xs uppercase font-mono text-muted-foreground">
          {ticket.type}
        </td>
      )}

      {visibleCols.title && (
        <td className="p-3 text-sm font-medium">
          <Link
            href={`/tickets/${ticket.key}`}
            className="hover:text-teal-400 transition-colors line-clamp-1"
            onClick={e => e.stopPropagation()}
          >
            {ticket.title}
          </Link>
        </td>
      )}

      {visibleCols.status && (
        <td className="p-3 text-xs">
          <span
            className={`px-2 py-0.5 rounded border font-medium text-[11px] ${
              STATUS_BADGE[ticket.status] ?? ''
            }`}
          >
            {STATUS_LABELS[ticket.status] ?? ticket.status}
          </span>
        </td>
      )}

      {visibleCols.priority && (
        <td className="p-3 text-xs">
          <span
            className={`px-2 py-0.5 rounded border uppercase text-[10px] font-mono tracking-wider ${
              PRIORITY_BADGE[ticket.priority] ?? ''
            }`}
          >
            {ticket.priority}
          </span>
        </td>
      )}

      {visibleCols.assignee && (
        <td className="p-3 text-xs text-muted-foreground">
          {assigneeLabel ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-teal-400">
              <UserCheckIcon className="w-3 h-3" />
              {assigneeLabel}
            </span>
          ) : (
            <span className="text-muted-foreground/40 italic">Unassigned</span>
          )}
        </td>
      )}

      {visibleCols.storyPoints && (
        <td className="p-3 text-xs font-mono text-muted-foreground">
          {ticket.storyPoints !== undefined && ticket.storyPoints !== null ? (
            <span className="px-1.5 py-0.5 bg-muted border border-border rounded">
              {ticket.storyPoints} pts
            </span>
          ) : (
            <span className="text-muted-foreground/30">—</span>
          )}
        </td>
      )}

      {visibleCols.updatedAt && (
        <td className="p-3 text-xs text-muted-foreground font-mono">
          {formatDistanceToNow(ticket.updatedAt, { addSuffix: true })}
        </td>
      )}
    </tr>
  )
}
