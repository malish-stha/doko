'use client'

import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SprintCard } from './SprintCard'
import { NewSprintDialog } from './NewSprintDialog'
import type { Doc } from '@/convex/_generated/dataModel'

export function SprintsStrip({
  sprints,
  allTickets,
}: {
  sprints: Doc<'sprints'>[]
  allTickets: Doc<'tickets'>[]
}) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
            Sprints
          </h2>
          <span className="text-xs font-mono text-muted-foreground">
            ({sprints.length})
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDialogOpen(true)}
          className="h-8 text-xs font-medium hover:text-teal-400"
        >
          <PlusIcon className="w-3.5 h-3.5 mr-1" />
          New Sprint
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 pt-1 border-b border-border/40 scrollbar-thin">
        {sprints.map(sprint => (
          <SprintCard
            key={sprint._id}
            sprint={sprint}
            tickets={allTickets.filter(t => t.sprintId === sprint._id)}
          />
        ))}

        {sprints.length === 0 && (
          <div className="flex-1 py-6 border border-dashed border-border/60 text-center rounded-none">
            <p className="text-xs text-muted-foreground mb-2">No sprints in planning or active state.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
              className="text-xs"
            >
              <PlusIcon className="w-3.5 h-3.5 mr-1" />
              Create First Sprint
            </Button>
          </div>
        )}
      </div>

      <NewSprintDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
