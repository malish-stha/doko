'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
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

const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const

export function BoardClient() {
  const projectId = 'doko' // hardcoded for v1 — single workspace project
  const params = useSearchParams()

  const q = params.get('q') || undefined
  const mine = params.get('mine') === '1'
  const hipri = params.get('hipri') === '1'
  const dueThisWeek = params.get('dueThisWeek') === '1'

  const tickets =
    useQuery(api.tickets.list, {
      projectId,
      q,
      mine: mine ? true : undefined,
      hipri: hipri ? true : undefined,
      dueThisWeek: dueThisWeek ? true : undefined,
    }) ?? []

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
    } finally {
      setOptimisticOverrides(prev => {
        const { [ticketId]: _, ...rest } = prev
        return rest
      })
    }
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

      <BoardFilters />

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
