'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
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
import { BlockedTicketsContext } from './TicketCard'
import { SavedFiltersDropdown } from '@/components/filters/SavedFiltersDropdown'
import { useHotkey } from '@/lib/hotkeys'
import { parseConvexError } from '@/lib/utils'

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
type Status = Doc<'tickets'>['status']
type Priority = Doc<'tickets'>['priority']
const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high', 'urgent']

/** Sprint scope lives in the URL (?sprint=active|all|<id>) so saved views keep it. */
function parseSprintParam(raw: string | null): SprintFilterValue {
  if (!raw || raw === 'active') return 'active'
  if (raw === 'all') return 'all'
  return raw as Id<'sprints'>
}

export function BoardClient() {
  const router = useRouter()
  const pathname = usePathname()
  const projectId = 'doko'
  const params = useSearchParams()

  const q = params.get('q') || undefined
  const mine = params.get('mine') === '1'
  const hipri = params.get('hipri') === '1'
  const dueThisWeek = params.get('dueThisWeek') === '1'
  const laneMode = (params.get('lanes') as SwimLaneMode) || 'none'
  const sprintFilter = parseSprintParam(params.get('sprint'))

  const setSprintFilter = useCallback(
    (value: SprintFilterValue) => {
      const next = new URLSearchParams(params.toString())
      if (value === 'active') next.delete('sprint')
      else next.set('sprint', value)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [params, pathname, router],
  )

  const [focusedTicketId, setFocusedTicketId] = useState<Id<'tickets'> | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<Id<'tickets'>>>(new Set())
  const [movePopoverOpen, setMovePopoverOpen] = useState(false)

  const boardConfig = useQuery(api.boardConfig.forMyTeam, {})
  const activeSprint = useQuery(api.sprints.activeSprint, {})
  const blockedList = useQuery(api.ticketLinks.blockedInTeam, {})
  const blockedIds = useMemo(() => new Set<Id<'tickets'>>(blockedList ?? []), [blockedList])

  const listArgs = useMemo(() => {
    const args: {
      projectId: string
      q?: string
      mine?: boolean
      hipri?: boolean
      dueThisWeek?: boolean
      mode?: 'active' | 'all' | 'sprint'
      sprintId?: Id<'sprints'>
    } = {
      projectId,
      q,
      mine: mine ? true : undefined,
      hipri: hipri ? true : undefined,
      dueThisWeek: dueThisWeek ? true : undefined,
    }
    if (sprintFilter === 'active') args.mode = 'active'
    else if (sprintFilter === 'all') args.mode = 'all'
    else args.sprintId = sprintFilter
    return args
  }, [q, mine, hipri, dueThisWeek, sprintFilter])

  const rawTickets = useQuery(api.tickets.list, listArgs)
  const tickets = useMemo(() => rawTickets ?? [], [rawTickets])

  const updateStatus = useMutation(api.tickets.updateStatus)
  const updateTicket = useMutation(api.tickets.update)

  // Optimistic patches, keyed by ticket id. An override is applied only until
  // the subscription reflects it (derived below), and removed once the
  // mutation settles, so the card never flickers back to the old column.
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<Id<'tickets'>, Partial<Doc<'tickets'>>>>({})

  const clearOverride = useCallback((ticketId: Id<'tickets'>) => {
    setOptimisticOverrides(prev => {
      if (!(ticketId in prev)) return prev
      const next = { ...prev }
      delete next[ticketId]
      return next
    })
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const activeColumns = useMemo<string[]>(() => {
    if (boardConfig?.visibleColumns && boardConfig.visibleColumns.length > 0) {
      return boardConfig.visibleColumns
    }
    return Array.from(DEFAULT_STATUSES)
  }, [boardConfig])

  const displayed = useMemo(() => {
    return tickets.map(t => {
      const override = optimisticOverrides[t._id]
      if (!override) return t
      // Once the server row already matches, the override is redundant.
      const settled = (Object.keys(override) as (keyof Doc<'tickets'>)[]).every(k => t[k] === override[k])
      return settled ? t : { ...t, ...override }
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
      if (prevColTickets.length > 0) setFocusedTicketId(prevColTickets[0]._id)
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
      if (nextColTickets.length > 0) setFocusedTicketId(nextColTickets[0]._id)
    }
  }, { description: 'Move focus to right column', scope: 'Board' })

  useHotkey('x', () => {
    if (!focusedTicketId) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(focusedTicketId)) next.delete(focusedTicketId)
      else next.add(focusedTicketId)
      return next
    })
  }, { description: 'Toggle select focused card', scope: 'Board' })

  useHotkey('Enter', () => {
    if (!focusedTicketId) return
    const focused = displayed.find(t => t._id === focusedTicketId)
    if (focused) router.push(`/tickets/${focused.key}`)
  }, { description: 'Open focused ticket detail', scope: 'Board' })

  useHotkey('m', () => {
    if (selectedIds.size > 0 || focusedTicketId) setMovePopoverOpen(true)
  }, { description: 'Open Move popover', scope: 'Board' })

  useHotkey('Escape', () => {
    setFocusedTicketId(null)
    setSelectedIds(new Set())
  }, { description: 'Clear focus and selection', scope: 'Board' })

  const handleCardClick = (id: Id<'tickets'>) => setFocusedTicketId(id)

  const handleCardSelectToggle = (id: Id<'tickets'>) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const wipLimits = boardConfig?.wipLimits as Partial<Record<Status, number | undefined>> | undefined

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.over.id === undefined) return
    const ticketId = e.active.id as Id<'tickets'>
    const targetOverId = String(e.over.id)

    let newStatus: Status | undefined
    let newLaneKey: string | undefined

    if (targetOverId.startsWith('lane::')) {
      const parts = targetOverId.split('::')
      newLaneKey = parts[1]
      newStatus = parts[2] as Status
    } else {
      newStatus = targetOverId as Status
    }

    const currentTicket = tickets.find(t => t._id === ticketId)
    if (!currentTicket || !newStatus) return

    // WIP limits are enforced server-side; block the drop up front so the card never moves.
    const limit = wipLimits?.[newStatus]
    if (currentTicket.status !== newStatus && limit !== undefined && limit > 0) {
      const inColumn = tickets.filter(t => t.status === newStatus && t._id !== ticketId).length
      if (inColumn + 1 > limit) {
        toast.error(
          'Column is full',
          `${newStatus.replace('_', ' ')} is at its WIP limit (${limit}). Move something out first.`,
        )
        return
      }
    }

    // Optimistic patch for the UI; the mutation payload uses null to clear fields.
    const optimistic: Partial<Doc<'tickets'>> = { status: newStatus }
    const patch: {
      id: Id<'tickets'>
      assigneeId?: string | null
      epicId?: Id<'tickets'> | null
      priority?: Priority
    } = { id: ticketId }

    if (laneMode === 'assignee' && newLaneKey) {
      const value = newLaneKey === 'Unassigned' ? null : newLaneKey
      optimistic.assigneeId = value ?? undefined
      if ((currentTicket.assigneeId ?? null) !== value) patch.assigneeId = value
    } else if (laneMode === 'epic' && newLaneKey) {
      const value = newLaneKey === 'No Epic' ? null : (newLaneKey as Id<'tickets'>)
      optimistic.epicId = value ?? undefined
      if ((currentTicket.epicId ?? null) !== value) patch.epicId = value
    } else if (laneMode === 'priority' && newLaneKey && (PRIORITIES as readonly string[]).includes(newLaneKey)) {
      optimistic.priority = newLaneKey as Priority
      if (currentTicket.priority !== newLaneKey) patch.priority = newLaneKey as Priority
    }

    const statusChanged = currentTicket.status !== newStatus
    const laneChanged = Object.keys(patch).length > 1
    if (!statusChanged && !laneChanged) return

    setOptimisticOverrides(prev => ({ ...prev, [ticketId]: optimistic }))

    try {
      if (statusChanged) await updateStatus({ id: ticketId, status: newStatus })
      if (laneChanged) await updateTicket(patch)
    } catch (err) {
      console.error('Failed to move ticket:', err)
      toast.error('Failed to update ticket', parseConvexError(err))
    } finally {
      // Convex applies a committed mutation to local query results before the
      // promise resolves, so dropping the override here does not flicker; on
      // failure it reverts the card to the server state.
      clearOverride(ticketId)
    }
  }

  if (rawTickets === undefined) {
    return <BoardSkeleton />
  }

  const targetIdsForMove = selectedIds.size > 0 ? Array.from(selectedIds) : focusedTicketId ? [focusedTicketId] : []

  return (
    <BlockedTicketsContext.Provider value={blockedIds}>
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

          {sprintFilter === 'active' && activeSprint && <SprintProgress sprint={activeSprint} tickets={displayed} />}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
                const wipLimit = wipLimits?.[status as Status]
                const customLabel = boardConfig?.columnLabels?.[status as Status]

                return (
                  <KanbanColumn
                    key={status}
                    status={status as Status}
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

        <MovePopover open={movePopoverOpen} onOpenChange={setMovePopoverOpen} targetIds={targetIdsForMove} />
      </div>
    </BlockedTicketsContext.Provider>
  )
}
