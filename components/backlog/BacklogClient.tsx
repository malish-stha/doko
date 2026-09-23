'use client'

import {
  DndContext,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { SprintsStrip } from './SprintsStrip'
import { ActiveSprintPanel } from './ActiveSprintPanel'
import { BacklogList } from './BacklogList'
import { NewTicketDialog } from '@/components/board/NewTicketDialog'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export function BacklogSkeleton() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-4">
          <Skeleton className="h-32 w-64" />
          <Skeleton className="h-32 w-64" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  )
}

export function BacklogClient() {
  const projectId = 'doko'

  const upcomingSprints = useQuery(
    api.sprints.listForTeam,
    {},
  )
  const activeSprint = useQuery(
    api.sprints.activeSprint,
    {},
  )
  // Server-side filtering: unscheduled tickets, and tickets already placed in a sprint.
  const backlogRaw = useQuery(api.tickets.list, { projectId, sprintId: null })
  const scheduledRaw = useQuery(api.tickets.list, { projectId, mode: 'scheduled' })
  const moveTicket = useMutation(api.sprints.moveTicket)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor),
  )

  if (
    upcomingSprints === undefined ||
    activeSprint === undefined ||
    backlogRaw === undefined ||
    scheduledRaw === undefined
  ) {
    return <BacklogSkeleton />
  }

  const backlogTickets = backlogRaw.filter(t => t.type !== 'epic')
  const activeSprintTickets = activeSprint ? scheduledRaw.filter(t => t.sprintId === activeSprint._id) : []

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over) return
    const ticketId = e.active.id as Id<'tickets'>
    const dropTarget = e.over.id as string

    try {
      if (dropTarget === 'backlog') {
        await moveTicket({ ticketId, sprintId: null })
        toast.success('Moved to Backlog', 'Ticket moved back to backlog.')
      } else if (dropTarget.startsWith('sprint:')) {
        const sprintId = dropTarget.slice('sprint:'.length) as Id<'sprints'>
        await moveTicket({ ticketId, sprintId })
        toast.success('Moved to Sprint', 'Ticket added to sprint.')
      }
    } catch (err: any) {
      toast.error('Failed to move ticket', parseConvexError(err))
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Backlog & Sprints</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Plan iterations, estimate tickets, and assign tasks to upcoming sprints.
            </p>
          </div>
          <NewTicketDialog projectId={projectId} />
        </div>

        <SprintsStrip
          sprints={upcomingSprints.filter(
            s => s.status === 'planning' || s.status === 'active',
          )}
          allTickets={scheduledRaw}
        />

        {activeSprint && (
          <ActiveSprintPanel
            sprint={activeSprint}
            tickets={activeSprintTickets}
          />
        )}

        <BacklogList tickets={backlogTickets} />
      </div>
    </DndContext>
  )
}
