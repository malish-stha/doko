'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { KanbanColumn } from './KanbanColumn'
import { NewTicketDialog } from './NewTicketDialog'
import { BoardFilters } from './BoardFilters'
import { SprintFilterBar, SprintFilterValue } from './SprintFilterBar'
import { SprintProgress } from './SprintProgress'

import { toast } from '@/components/ui/toast'
import { Skeleton } from '@/components/ui/skeleton'

export function BoardSkeleton() {
  const STATUSES = ['Backlog', 'Todo', 'In Progress', 'Review', 'Done']
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div className="space-y-1">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Filters Skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>

      {/* Columns Skeleton */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map((title, idx) => (
          <div
            key={idx}
            className="w-72 min-w-[18rem] rounded-none border border-border/40 bg-card/40 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-6 rounded-none" />
            </div>
            <div className="space-y-3 pt-2">
              <Skeleton className="h-28 w-full rounded-none" />
              <Skeleton className="h-24 w-full rounded-none" />
              <Skeleton className="h-20 w-full rounded-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const

export function BoardClient() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const projectId = 'doko' // hardcoded for v1 — single workspace project
  const params = useSearchParams()

  const q = params.get('q') || undefined
  const mine = params.get('mine') === '1'
  const hipri = params.get('hipri') === '1'
  const dueThisWeek = params.get('dueThisWeek') === '1'

  const [sprintFilter, setSprintFilter] = useState<SprintFilterValue>('active')

  const activeSprint = useQuery(
    api.sprints.activeSprint,
    userEmail ? { userEmail } : {},
  )

  const listArgs: any = {
    projectId,
    q,
    mine: mine ? true : undefined,
    hipri: hipri ? true : undefined,
    dueThisWeek: dueThisWeek ? true : undefined,
  }

  if (sprintFilter === 'active') {
    listArgs.mode = 'active'
  } else if (sprintFilter === 'all') {
    listArgs.mode = 'all'
  } else {
    listArgs.sprintId = sprintFilter
  }

  const rawTickets = useQuery(api.tickets.list, listArgs)
  const tickets = rawTickets ?? []

  const updateStatus = useMutation(api.tickets.updateStatus)

  const [optimisticOverrides, setOptimisticOverrides] = useState<
    Record<Id<'tickets'>, Doc<'tickets'>['status']>
  >({})

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor),
  )

  const displayed = tickets.map(t => ({
    ...t,
    status: optimisticOverrides[t._id] ?? t.status,
  }))

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.over.id === undefined) return
    const ticketId = e.active.id as Id<'tickets'>
    const newStatus = e.over.id as Doc<'tickets'>['status']

    const currentTicket = tickets.find(t => t._id === ticketId)
    if (!currentTicket || currentTicket.status === newStatus) return

    setOptimisticOverrides(prev => ({ ...prev, [ticketId]: newStatus }))

    try {
      await updateStatus({ id: ticketId, status: newStatus })
    } catch (err: any) {
      console.error('Failed to move ticket:', err)
      toast.error('Failed to update status', err?.message ?? 'Could not move ticket.')
    } finally {
      setOptimisticOverrides(prev => {
        const { [ticketId]: _, ...rest } = prev
        return rest
      })
    }
  }

  if (rawTickets === undefined) {
    return <BoardSkeleton />
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Board</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Project: doko</p>
        </div>
        <NewTicketDialog projectId={projectId} />
      </div>

      <div className="space-y-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <BoardFilters />
          <SprintFilterBar value={sprintFilter} onChange={setSprintFilter} />
        </div>

        {sprintFilter === 'active' && activeSprint && (
          <SprintProgress sprint={activeSprint} tickets={displayed} />
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUSES.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tickets={displayed.filter(t => t.status === status)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
