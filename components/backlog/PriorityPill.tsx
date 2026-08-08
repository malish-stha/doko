'use client'

import { cn } from '@/lib/utils'

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-muted/60 text-muted-foreground border-border',
  medium: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-500 border-red-500/20 font-semibold',
}

export function PriorityPill({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        'text-[10px] px-1.5 py-0.5 border font-mono uppercase tracking-wider',
        PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium,
      )}
    >
      {priority}
    </span>
  )
}
