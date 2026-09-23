'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { TicketRow } from './TicketRow'
import { FilterBar } from './FilterBar'
import { BulkActionBar } from '@/components/board/BulkActionBar'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowUpDownIcon, ArrowUpIcon, ArrowDownIcon } from 'lucide-react'

type Ticket = Doc<'tickets'>
type SortField = 'key' | 'type' | 'title' | 'status' | 'priority' | 'assigneeId' | 'storyPoints' | 'updatedAt'

const PRIORITY_ORDER: Record<Ticket['priority'], number> = { low: 0, medium: 1, high: 2, urgent: 3 }
const STATUS_ORDER: Record<Ticket['status'], number> = { backlog: 0, todo: 1, in_progress: 2, review: 3, done: 4 }

/** "TASK-12" sorts after "TASK-9" and before "TASK-100". */
function compareKeys(a: string, b: string) {
  const [pa, na] = a.split('-')
  const [pb, nb] = b.split('-')
  if (pa !== pb) return pa.localeCompare(pb)
  return Number(na) - Number(nb)
}

/** Undefined sorts last regardless of direction. */
function compareNumbers(a: number | undefined, b: number | undefined) {
  if (a === undefined && b === undefined) return 0
  if (a === undefined) return 1
  if (b === undefined) return -1
  return a - b
}

const COMPARATORS: Record<SortField, (a: Ticket, b: Ticket) => number> = {
  key: (a, b) => compareKeys(a.key, b.key),
  type: (a, b) => a.type.localeCompare(b.type),
  title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }),
  status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  priority: (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  assigneeId: (a, b) => (a.assigneeId ?? '￿').localeCompare(b.assigneeId ?? '￿'),
  storyPoints: (a, b) => compareNumbers(a.storyPoints, b.storyPoints),
  updatedAt: (a, b) => a.updatedAt - b.updatedAt,
}

function parseSort(raw: string): { field: SortField; dir: 'asc' | 'desc' } {
  const [field, dir] = raw.split(':')
  const safeField = (field in COMPARATORS ? field : 'updatedAt') as SortField
  return { field: safeField, dir: dir === 'asc' ? 'asc' : 'desc' }
}

export function TicketsListClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const q = searchParams.get('q') || ''
  const statusFilter = searchParams.get('status') || ''
  const priorityFilter = searchParams.get('priority') || ''
  const assigneeFilter = searchParams.get('assignee') || ''
  const sort = parseSort(searchParams.get('sort') || 'updatedAt:desc')

  const [selectedIds, setSelectedIds] = useState<Set<Id<'tickets'>>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
    key: true,
    type: true,
    title: true,
    status: true,
    priority: true,
    assignee: true,
    storyPoints: true,
    updatedAt: true,
  })

  const rawTickets = useQuery(api.tickets.list, { projectId: 'doko', mode: 'all' })
  const isLoading = rawTickets === undefined

  const filtered = useMemo(() => {
    const all = rawTickets ?? []
    return all.filter(t => {
      if (q) {
        const needle = q.toLowerCase()
        if (!t.key.toLowerCase().includes(needle) && !t.title.toLowerCase().includes(needle)) return false
      }
      if (statusFilter && t.status !== statusFilter) return false
      if (priorityFilter && t.priority !== priorityFilter) return false
      if (assigneeFilter) {
        if (assigneeFilter === 'unassigned' && t.assigneeId) return false
        if (assigneeFilter !== 'unassigned' && t.assigneeId !== assigneeFilter) return false
      }
      return true
    })
  }, [rawTickets, q, statusFilter, priorityFilter, assigneeFilter])

  const sorted = useMemo(() => {
    const cmp = COMPARATORS[sort.field]
    const modifier = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => cmp(a, b) * modifier || compareKeys(a.key, b.key))
  }, [filtered, sort.field, sort.dir])

  // Selection never outlives the visible set: drop ids that filtered out.
  useEffect(() => {
    if (selectedIds.size === 0) return
    const visible = new Set(sorted.map(t => t._id))
    if (Array.from(selectedIds).every(id => visible.has(id))) return
    setSelectedIds(prev => new Set(Array.from(prev).filter(id => visible.has(id))))
    setLastSelectedIndex(null)
  }, [sorted, selectedIds])

  const handleSortClick = (field: SortField) => {
    const nextDir = sort.field === field && sort.dir === 'asc' ? 'desc' : 'asc'
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', `${field}:${nextDir}`)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const allVisibleSelected = sorted.length > 0 && sorted.every(t => selectedIds.has(t._id))

  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(sorted.map(t => t._id)))
    setLastSelectedIndex(null)
  }

  const handleRowSelect = (index: number, ticketId: Id<'tickets'>, e: { shiftKey: boolean }) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (e.shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index)
        const end = Math.max(lastSelectedIndex, index)
        for (let i = start; i <= end; i++) {
          if (sorted[i]) next.add(sorted[i]._id)
        }
      } else if (next.has(ticketId)) {
        next.delete(ticketId)
      } else {
        next.add(ticketId)
      }
      return next
    })
    setLastSelectedIndex(index)
  }

  const toggleCol = (colKey: string) => {
    setVisibleCols(prev => ({ ...prev, [colKey]: !prev[colKey] }))
  }

  const renderSortHeader = (field: SortField, label: string) => {
    const isActive = sort.field === field
    return (
      <th
        aria-sort={isActive ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className="p-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider select-none"
      >
        <button
          type="button"
          onClick={() => handleSortClick(field)}
          className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
        >
          <span>{label}</span>
          {isActive ? (
            sort.dir === 'asc' ? (
              <ArrowUpIcon className="w-3 h-3 text-teal-400" aria-hidden />
            ) : (
              <ArrowDownIcon className="w-3 h-3 text-teal-400" aria-hidden />
            )
          ) : (
            <ArrowUpDownIcon className="w-3 h-3 text-muted-foreground/30" aria-hidden />
          )}
        </button>
      </th>
    )
  }

  const columnCount = 1 + Object.values(visibleCols).filter(Boolean).length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading ? 'Loading tickets…' : `Filterable and sortable list view (${sorted.length} tickets)`}
          </p>
        </div>
      </div>

      <FilterBar visibleCols={visibleCols} onToggleCol={toggleCol} />

      <div className="border border-border/80 rounded-md overflow-hidden bg-card/80 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/40 border-b border-border/60">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all visible tickets"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    disabled={isLoading || sorted.length === 0}
                    className="rounded border-border text-teal-500 focus:ring-teal-400 h-4 w-4 cursor-pointer"
                  />
                </th>
                {visibleCols.key && renderSortHeader('key', 'Key')}
                {visibleCols.type && renderSortHeader('type', 'Type')}
                {visibleCols.title && renderSortHeader('title', 'Title')}
                {visibleCols.status && renderSortHeader('status', 'Status')}
                {visibleCols.priority && renderSortHeader('priority', 'Priority')}
                {visibleCols.assignee && renderSortHeader('assigneeId', 'Assignee')}
                {visibleCols.storyPoints && renderSortHeader('storyPoints', 'Points')}
                {visibleCols.updatedAt && renderSortHeader('updatedAt', 'Updated')}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border/40" aria-busy="true">
                    <td colSpan={columnCount} className="p-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="p-8 text-center text-xs text-muted-foreground/60 italic">
                    No tickets found matching current filters.
                  </td>
                </tr>
              ) : (
                sorted.map((t, idx) => (
                  <TicketRow
                    key={t._id}
                    ticket={t}
                    selected={selectedIds.has(t._id)}
                    visibleCols={visibleCols}
                    onSelectToggle={e => handleRowSelect(idx, t._id, e)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BulkActionBar selectedIds={selectedIds} onClear={() => setSelectedIds(new Set())} />
    </div>
  )
}
