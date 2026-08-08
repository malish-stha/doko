'use client'

import { useState, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
import { SwimLaneToggle, SwimLaneMode } from './SwimLaneToggle'
import { BoardWithSwimlanes } from './BoardWithSwimlanes'
import { BulkActionBar } from './BulkActionBar'
import { MovePopover } from './MovePopover'
import { SavedFiltersDropdown } from '@/components/filters/SavedFiltersDropdown'
import { useHotkey } from '@/lib/hotkeys'

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

      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>

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

const DEFAULT_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const

export function BoardClient() {
  const router = useRouter()
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const projectId = 'doko'
  const params = useSearchParams()

  const q = params.get('q') || undefined
  const mine = params.get('mine') === '1'
  const hipri = params.get('hipri') === '1'
  const dueThisWeek = params.get('dueThisWeek') === '1'
  const laneMode = (params.get('lanes') as SwimLaneMode) || 'none'

  const [sprintFilter, setSprintFilter] = useState<SprintFilterValue>('active')
  const [focusedTicketId, setFocusedTicketId] = useState<Id<'tickets'> | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<Id<'tickets'>>>(new Set())
  const [movePopoverOpen, setMovePopoverOpen] = useState(false)

  const boardConfig = useQuery(api.boardConfig.forMyTeam, {})
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
  const updateTicket = useMutation(api.tickets.update)

  const [optimisticOverrides, setOptimisticOverrides] = useState<
    Record<Id<'tickets'>, Partial<Doc<'tickets'>>>
  >({})

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor),
  )

  const activeColumns = useMemo(() => {
    if (boardConfig?.visibleColumns && boardConfig.visibleColumns.length > 0) {
      return boardConfig.visibleColumns
    }
    return Array.from(DEFAULT_STATUSES)
  }, [boardConfig])

  const displayed = useMemo(() => {
    return tickets.map(t => {
      const override = optimisticOverrides[t._id]
      if (!override) return t
      return { ...t, ...override }
    })
  }, [tickets, optimisticOverrides])

  // --- Keyboard navigation hooks ---
  useHotkey('j', () => {
    if (displayed.length === 0) return
    if (!focusedTicketId) {
      setFocusedTicketId(displayed[0]._id)
      return
    }
    const idx = displayed.findIndex(t => t._id === focusedTicketId)
    if (idx !== -1 && idx < displayed.length - 1) {
      setFocusedTicketId(displayed[idx + 1]._id)
    }
  }, { description: 'Focus next card', scope: 'Board' })

  useHotkey('k', () => {
    if (displayed.length === 0) return
    if (!focusedTicketId) {
      setFocusedTicketId(displayed[0]._id)
      return
    }
    const idx = displayed.findIndex(t => t._id === focusedTicketId)
    if (idx > 0) {
      setFocusedTicketId(displayed[idx - 1]._id)
    }
  }, { description: 'Focus previous card', scope: 'Board' })

  useHotkey('h', () => {
    if (!focusedTicketId) return
    const focused = displayed.find(t => t._id === focusedTicketId)
    if (!focused) return
    const colIdx = activeColumns.indexOf(focused.status)
    if (colIdx > 0) {
      const prevCol = activeColumns[colIdx - 1]
      const prevColTickets = displayed.filter(t => t.status === prevCol)
      if (prevColTickets.length > 0) {
        setFocusedTicketId(prevColTickets[0]._id)
      }
    }
  }, { description: 'Move focus to left column', scope: 'Board' })

  useHotkey('l', () => {
    if (!focusedTicketId) return
    const focused = displayed.find(t => t._id === focusedTicketId)
    if (!focused) return
    const colIdx = activeColumns.indexOf(focused.status)
    if (colIdx !== -1 && colIdx < activeColumns.length - 1) {
      const nextCol = activeColumns[colIdx + 1]
      const nextColTickets = displayed.filter(t => t.status === nextCol)
      if (nextColTickets.length > 0) {
        setFocusedTicketId(nextColTickets[0]._id)
      }
    }
  }, { description: 'Move focus to right column', scope: 'Board' })

  useHotkey('x', () => {
    if (!focusedTicketId) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(focusedTicketId)) {
        next.delete(focusedTicketId)
      } else {
        next.add(focusedTicketId)
      }
      return next
    })
  }, { description: 'Toggle select focused card', scope: 'Board' })

  useHotkey('Enter', () => {
    if (!focusedTicketId) return
    const focused = displayed.find(t => t._id === focusedTicketId)
    if (focused) {
      router.push(`/tickets/${focused.key}`)
    }
  }, { description: 'Open focused ticket detail', scope: 'Board' })

  useHotkey('m', () => {
    if (selectedIds.size > 0 || focusedTicketId) {
      setMovePopoverOpen(true)
    }
  }, { description: 'Open Move popover', scope: 'Board' })

  useHotkey('Escape', () => {
    setFocusedTicketId(null)
    setSelectedIds(new Set())
  }, { description: 'Clear focus and selection', scope: 'Board' })

  const handleCardClick = (id: Id<'tickets'>) => {
    setFocusedTicketId(id)
  }

  const handleCardSelectToggle = (id: Id<'tickets'>) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.over.id === undefined) return
    const ticketId = e.active.id as Id<'tickets'>
    const targetOverId = String(e.over.id)

    let newStatus: Doc<'tickets'>['status'] | undefined
    let newLaneKey: string | undefined

    if (targetOverId.startsWith('lane::')) {
      const parts = targetOverId.split('::')
      newLaneKey = parts[1]
      newStatus = parts[2] as Doc<'tickets'>['status']
    } else {
      newStatus = targetOverId as Doc<'tickets'>['status']
    }

    const currentTicket = tickets.find(t => t._id === ticketId)
    if (!currentTicket || !newStatus) return

    // Check WIP limit warning
    const wipLimits = boardConfig?.wipLimits as Record<string, number | undefined> | undefined
    const limit = wipLimits?.[newStatus]
    if (limit !== undefined && limit > 0) {
      const targetCount = tickets.filter(t => t.status === newStatus && t._id !== ticketId).length + 1
      if (targetCount > limit) {
        toast.warning(
          `${newStatus.replace('_', ' ').toUpperCase()} is over the WIP limit (${limit}). Consider resolving existing items first.`,
        )
      }
    }

    const patchPayload: Partial<Doc<'tickets'>> = { status: newStatus }

    if (laneMode === 'assignee' && newLaneKey) {
      patchPayload.assigneeId = newLaneKey === 'Unassigned' ? undefined : newLaneKey
    } else if (laneMode === 'epic' && newLaneKey) {
      patchPayload.epicId = newLaneKey === 'No Epic' ? undefined : (newLaneKey as Id<'tickets'>)
    } else if (laneMode === 'priority' && newLaneKey) {
      patchPayload.priority = newLaneKey as any
    }

    setOptimisticOverrides(prev => ({ ...prev, [ticketId]: patchPayload }))

    try {
      if (Object.keys(patchPayload).length > 1) {
        await updateTicket({ id: ticketId, ...patchPayload })
      } else {
        await updateStatus({ id: ticketId, status: newStatus })
      }
    } catch (err: any) {
      console.error('Failed to move ticket:', err)
      toast.error('Failed to update ticket', err?.message ?? 'Could not update ticket.')
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

  const targetIdsForMove = selectedIds.size > 0
    ? Array.from(selectedIds)
    : focusedTicketId
    ? [focusedTicketId]
    : []

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
          <div className="flex items-center gap-2 flex-wrap">
            <BoardFilters />
            <SavedFiltersDropdown scope="board" />
            <SwimLaneToggle />
          </div>
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
        {laneMode !== 'none' ? (
          <BoardWithSwimlanes
            tickets={displayed}
            laneMode={laneMode as 'assignee' | 'epic' | 'priority'}
            columns={activeColumns}
            columnLabels={boardConfig?.columnLabels}
            focusedTicketId={focusedTicketId}
            selectedIds={selectedIds}
            onCardClick={handleCardClick}
            onCardSelectToggle={handleCardSelectToggle}
          />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {activeColumns.map(status => {
              const wipLimits = boardConfig?.wipLimits as Record<string, number | undefined> | undefined
              const wipLimit = wipLimits?.[status]
              const customLabel = boardConfig?.columnLabels?.[status]

              return (
                <KanbanColumn
                  key={status}
                  status={status as Doc<'tickets'>['status']}
                  tickets={displayed.filter(t => t.status === status)}
                  wipLimit={wipLimit}
                  customLabel={customLabel}
                  focusedTicketId={focusedTicketId}
                  selectedIds={selectedIds}
                  onCardClick={handleCardClick}
                  onCardSelectToggle={handleCardSelectToggle}
                />
              )
            })}
          </div>
        )}
      </DndContext>

      <BulkActionBar selectedIds={selectedIds} onClear={() => setSelectedIds(new Set())} />

      <MovePopover
        open={movePopoverOpen}
        onOpenChange={setMovePopoverOpen}
        targetIds={targetIdsForMove}
      />
    </div>
  )
}
