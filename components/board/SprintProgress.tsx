'use client'

import type { Doc } from '@/convex/_generated/dataModel'
import { Progress } from '@/components/ui/progress'

export function SprintProgress({
  sprint,
  tickets,
}: {
  sprint: Doc<'sprints'>
  tickets: Doc<'tickets'>[]
}) {
  const currentTotal = tickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
  const donePoints = tickets
    .filter(t => t.status === 'done')
    .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)

  const planned = sprint.plannedPoints ?? currentTotal
  const extraPoints = currentTotal > planned ? currentTotal - planned : 0
  const rawPercent = planned > 0 ? (donePoints / planned) * 100 : 0
  // Scope creep can push completed points past the plan; the bar caps at 100%.
  const percent = Math.min(100, Math.max(0, rawPercent))
  const overflow = donePoints > planned ? donePoints - planned : 0

  return (
    <div className="border border-border/80 bg-card/60 p-3 mb-4 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono uppercase font-semibold text-teal-400">Sprint Progress</span>
          <span className="text-muted-foreground font-mono">{sprint.name}</span>
          {extraPoints > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20">
              +{extraPoints} pts added
            </span>
          )}
          {overflow > 0 && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.2 bg-teal-500/10 text-teal-400 border border-teal-500/20"
              title="Completed points beyond the original plan"
            >
              +{overflow} pts over plan
            </span>
          )}
        </div>

        <div className="font-mono text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{donePoints}</span> / {planned} pts completed
          <span className="ml-2 font-mono text-[10px] text-muted-foreground">({Math.round(rawPercent)}%)</span>
        </div>
      </div>

      <Progress value={percent} className="h-2" aria-label={`${Math.round(rawPercent)}% of planned points completed`} />
    </div>
  )
}
