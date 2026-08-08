'use client'

import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  done: 'Done',
}

const STATUS_STYLES: Record<string, string> = {
  backlog: 'bg-muted/60 text-muted-foreground border-border',
  todo: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  review: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  done: 'bg-teal-500/10 text-teal-400 border-teal-500/20 font-semibold',
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'text-[10px] px-2 py-0.5 border font-mono uppercase tracking-wider',
        STATUS_STYLES[status] ?? STATUS_STYLES.todo,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
