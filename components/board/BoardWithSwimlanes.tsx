'use client'

import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { TicketCard } from './TicketCard'
import { SwimLaneMode } from './SwimLaneToggle'

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
}

interface SwimlaneCellProps {
  laneKey: string
  status: Doc<'tickets'>['status']
  tickets: Doc<'tickets'>[]
  focusedTicketId?: Id<'tickets'> | null
  selectedIds?: Set<Id<'tickets'>>
  onCardClick?: (id: Id<'tickets'>) => void
  onCardSelectToggle?: (id: Id<'tickets'>) => void
}

function SwimlaneCell({
  laneKey,
  status,
  tickets,
  focusedTicketId,
  selectedIds,
  onCardClick,
  onCardSelectToggle,
}: SwimlaneCellProps) {
  const droppableId = `lane::${laneKey}::${status}`
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 p-2 border transition-colors ${
        isOver
          ? 'border-teal-500 border-solid bg-teal-500/5'
          : 'border-dashed border-border/40 bg-muted/10'
      } min-h-[100px] flex-1`}
    >
      {tickets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[11px] text-muted-foreground/30 font-mono italic">
          Empty
        </div>
      ) : (
        tickets.map(t => (
          <TicketCard
            key={t._id}
            ticket={t}
            focused={focusedTicketId === t._id}
            selected={selectedIds?.has(t._id)}
            onClick={() => onCardClick?.(t._id)}
            onSelectToggle={() => onCardSelectToggle?.(t._id)}
          />
        ))
      )}
    </div>
  )
}

export function BoardWithSwimlanes({
  tickets,
  laneMode,
  columns = ['backlog', 'todo', 'in_progress', 'review', 'done'],
  columnLabels = {},
  focusedTicketId,
  selectedIds,
  onCardClick,
  onCardSelectToggle,
}: {
  tickets: Doc<'tickets'>[]
  laneMode: 'assignee' | 'epic' | 'priority'
  columns?: string[]
  columnLabels?: Record<string, string>
  focusedTicketId?: Id<'tickets'> | null
  selectedIds?: Set<Id<'tickets'>>
  onCardClick?: (id: Id<'tickets'>) => void
  onCardSelectToggle?: (id: Id<'tickets'>) => void
}) {
  const teamMembers = useQuery(api.teamMembers.listForTeam, {}) ?? []
  const epics = tickets.filter(t => t.type === 'epic')

  // Derive unique swim lane keys based on mode
  const laneGroups: Record<string, { label: string; tickets: Doc<'tickets'>[] }> = {}

  if (laneMode === 'assignee') {
    // Collect all assignee IDs
    const memberMap = new Map<string, string>()
    for (const m of teamMembers) {
      memberMap.set(m.userId, m.name ?? m.email)
    }

    const laneKeysSet = new Set<string>()
    for (const t of tickets) {
      laneKeysSet.add(t.assigneeId ?? 'Unassigned')
    }

    const sortedKeys = Array.from(laneKeysSet).sort((a, b) => {
      if (a === 'Unassigned') return 1
      if (b === 'Unassigned') return -1
      return (memberMap.get(a) ?? a).localeCompare(memberMap.get(b) ?? b)
    })

    for (const k of sortedKeys) {
      const label = k === 'Unassigned' ? 'Unassigned' : memberMap.get(k) ?? (k.includes('@') ? k.split('@')[0] : k)
      laneGroups[k] = { label, tickets: [] }
    }

    for (const t of tickets) {
      const k = t.assigneeId ?? 'Unassigned'
      if (laneGroups[k]) laneGroups[k].tickets.push(t)
    }
  } else if (laneMode === 'epic') {
    const epicMap = new Map<string, string>()
    for (const e of epics) {
      epicMap.set(e._id, e.title)
    }

    const laneKeysSet = new Set<string>()
    for (const t of tickets) {
      if (t.type !== 'epic') {
        laneKeysSet.add(t.epicId ?? 'No Epic')
      }
    }

    const sortedKeys = Array.from(laneKeysSet).sort((a, b) => {
      if (a === 'No Epic') return 1
      if (b === 'No Epic') return -1
      return (epicMap.get(a) ?? a).localeCompare(epicMap.get(b) ?? b)
    })

    for (const k of sortedKeys) {
      const label = k === 'No Epic' ? 'No Epic' : epicMap.get(k) ?? 'Unknown Epic'
      laneGroups[k] = { label, tickets: [] }
    }

    for (const t of tickets) {
      if (t.type !== 'epic') {
        const k = t.epicId ?? 'No Epic'
        if (laneGroups[k]) laneGroups[k].tickets.push(t)
      }
    }
  } else if (laneMode === 'priority') {
    const priorities = ['urgent', 'high', 'medium', 'low']
    for (const p of priorities) {
      laneGroups[p] = { label: p.toUpperCase(), tickets: [] }
    }
    for (const t of tickets) {
      if (laneGroups[t.priority]) laneGroups[t.priority].tickets.push(t)
    }
  }

  const laneKeys = Object.keys(laneGroups)

  return (
    <div className="overflow-x-auto pb-6">
      <div
        className="grid gap-3 min-w-[900px]"
        style={{
          gridTemplateColumns: `140px repeat(${columns.length}, minmax(220px, 1fr))`,
        }}
      >
        {/* Header Row */}
        <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wider p-2 flex items-end">
          {laneMode}
        </div>
        {columns.map(col => (
          <div
            key={col}
            className="font-semibold text-xs text-muted-foreground uppercase tracking-wider p-2 border-b border-border/60"
          >
            {columnLabels[col] ?? STATUS_LABELS[col] ?? col}
          </div>
        ))}

        {/* Swimlane Rows */}
        {laneKeys.map(laneKey => {
          const group = laneGroups[laneKey]
          return (
            <React.Fragment key={laneKey}>
              <div className="p-3 bg-muted/20 border border-border/40 font-medium text-xs flex items-center justify-between truncate rounded-l-md">
                <span className="truncate font-semibold text-foreground">{group.label}</span>
                <span className="text-[10px] font-mono text-muted-foreground ml-1">
                  ({group.tickets.length})
                </span>
              </div>
              {columns.map(col => {
                const cellTickets = group.tickets.filter(t => t.status === col)
                return (
                  <SwimlaneCell
                    key={col}
                    laneKey={laneKey}
                    status={col as Doc<'tickets'>['status']}
                    tickets={cellTickets}
                    focusedTicketId={focusedTicketId}
                    selectedIds={selectedIds}
                    onCardClick={onCardClick}
                    onCardSelectToggle={onCardSelectToggle}
                  />
                )
              })}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
