'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { SavedFiltersDropdown } from '@/components/filters/SavedFiltersDropdown'
import { SearchIcon, ColumnsIcon, XIcon } from 'lucide-react'

export function FilterBar({
  visibleCols,
  onToggleCol,
}: {
  visibleCols: Record<string, boolean>
  onToggleCol: (col: string) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || ''
  const priority = searchParams.get('priority') || ''
  const assignee = searchParams.get('assignee') || ''

  const updateFilter = (key: string, val: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (val) {
      params.set(key, val)
    } else {
      params.delete(key)
    }
    router.replace(`${pathname}?${params.toString()}`)
  }

  const clearAll = () => {
    router.replace(pathname)
  }

  const hasActiveFilters = Boolean(q || status || priority || assignee)

  const COLUMNS = [
    { key: 'key', label: 'Key' },
    { key: 'type', label: 'Type' },
    { key: 'title', label: 'Title' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'assignee', label: 'Assignee' },
    { key: 'storyPoints', label: 'Story Points' },
    { key: 'updatedAt', label: 'Updated' },
  ]

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[300px]">
        <div className="relative w-64">
          <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filter by keyword..."
            value={q}
            onChange={e => updateFilter('q', e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <select
          value={status}
          onChange={e => updateFilter('status', e.target.value)}
          className="h-8 text-xs bg-card border border-border/80 rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-teal-400"
        >
          <option value="">All Statuses</option>
          <option value="backlog">Backlog</option>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>

        <select
          value={priority}
          onChange={e => updateFilter('priority', e.target.value)}
          className="h-8 text-xs bg-card border border-border/80 rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-teal-400"
        >
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
          >
            <XIcon className="w-3 h-3" />
            Reset
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <SavedFiltersDropdown scope="list" />

        <Popover>
          <PopoverTrigger className="inline-flex items-center gap-1.5 px-3 py-1.5 h-8 text-xs font-medium border border-border/80 border-dashed rounded-md bg-card hover:bg-accent text-foreground cursor-pointer transition-colors">
            <ColumnsIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Columns</span>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-2 space-y-1">
            <div className="text-[11px] font-semibold uppercase text-muted-foreground px-2 py-1 border-b border-border/40 mb-1">
              Toggle Columns
            </div>
            {COLUMNS.map(col => (
              <label
                key={col.key}
                className="flex items-center gap-2 px-2 py-1 hover:bg-muted/50 rounded cursor-pointer text-xs"
              >
                <input
                  type="checkbox"
                  checked={visibleCols[col.key] ?? true}
                  onChange={() => onToggleCol(col.key)}
                  className="rounded border-border text-teal-500 focus:ring-teal-400 h-3.5 w-3.5"
                />
                <span>{col.label}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
