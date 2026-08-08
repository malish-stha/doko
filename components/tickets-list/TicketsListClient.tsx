'use client'

import { useState, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { TicketRow } from './TicketRow'
import { FilterBar } from './FilterBar'
import { BulkActionBar } from '@/components/board/BulkActionBar'
import { ArrowUpDownIcon, ArrowUpIcon, ArrowDownIcon } from 'lucide-react'

export function TicketsListClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const q = searchParams.get('q') || ''
  const statusFilter = searchParams.get('status') || ''
  const priorityFilter = searchParams.get('priority') || ''
  const assigneeFilter = searchParams.get('assignee') || ''
  const sortParam = searchParams.get('sort') || 'updatedAt:desc'

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

  const rawTickets = useQuery(api.tickets.list, { projectId: 'doko', mode: 'all' }) ?? []

  // Filter tickets locally based on URL params
  const filtered = useMemo(() => {
    return rawTickets.filter(t => {
      if (q) {
        const needle = q.toLowerCase()
        const matchesKey = t.key.toLowerCase().includes(needle)
        const matchesTitle = t.title.toLowerCase().includes(needle)
        if (!matchesKey && !matchesTitle) return false
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

  // Sort tickets
  const sorted = useMemo(() => {
    const [field, dir] = sortParam.split(':')
    const modifier = dir === 'asc' ? 1 : -1

    return [...filtered].sort((a: any, b: any) => {
      let valA = a[field] ?? ''
      let valB = b[field] ?? ''

      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()

      if (valA < valB) return -1 * modifier
      if (valA > valB) return 1 * modifier
      return 0
    })
  }, [filtered, sortParam])

  const handleSortClick = (field: string) => {
    const [currentField, currentDir] = sortParam.split(':')
    let nextDir = 'asc'
    if (currentField === field && currentDir === 'asc') {
      nextDir = 'desc'
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', `${field}:${nextDir}`)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sorted.map(t => t._id)))
    }
  }

  const handleRowSelect = (index: number, ticketId: Id<'tickets'>, e: React.MouseEvent) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (e.shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index)
        const end = Math.max(lastSelectedIndex, index)
        for (let i = start; i <= end; i++) {
          if (sorted[i]) next.add(sorted[i]._id)
        }
      } else {
        if (next.has(ticketId)) {
          next.delete(ticketId)
        } else {
          next.add(ticketId)
        }
      }
      return next
    })
    setLastSelectedIndex(index)
  }

  const toggleCol = (colKey: string) => {
    setVisibleCols(prev => ({ ...prev, [colKey]: !prev[colKey] }))
  }

  const renderSortHeader = (field: string, label: string) => {
    const [currentField, currentDir] = sortParam.split(':')
    const isActive = currentField === field

    return (
      <th
        onClick={() => handleSortClick(field)}
        className="p-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none transition-colors"
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          {isActive ? (
            currentDir === 'asc' ? (
              <ArrowUpIcon className="w-3 h-3 text-teal-400" />
            ) : (
              <ArrowDownIcon className="w-3 h-3 text-teal-400" />
            )
          ) : (
            <ArrowUpDownIcon className="w-3 h-3 text-muted-foreground/30 hover:text-muted-foreground" />
          )}
        </div>
      </th>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Filterable and sortable list view ({sorted.length} tickets)
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
                    checked={sorted.length > 0 && selectedIds.size === sorted.length}
                    onChange={toggleSelectAll}
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
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="p-8 text-center text-xs text-muted-foreground/60 italic"
                  >
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
