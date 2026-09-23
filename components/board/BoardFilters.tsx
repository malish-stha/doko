'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SearchIcon, XIcon } from 'lucide-react'
import { useDebouncedCallback } from '@/lib/useDebouncedCallback'

type Chip = { key: string; label: string }
const CHIPS: Chip[] = [
  { key: 'mine', label: 'My tickets' },
  { key: 'hipri', label: 'High+ priority' },
  { key: 'dueThisWeek', label: 'Due this week' },
]

/** Params this bar owns. Everything else (lanes, sprint) is left untouched. */
export const BOARD_FILTER_KEYS = ['q', 'mine', 'hipri', 'dueThisWeek'] as const

export function BoardFilters() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const qParam = params.get('q') ?? ''
  const [searchValue, setSearchValue] = useState(qParam)

  // Re-sync when the URL changes from elsewhere (saved view, back button).
  useEffect(() => {
    setSearchValue(qParam)
  }, [qParam])

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  // One navigation ~300ms after the user stops typing instead of one per keystroke.
  const setSearchParam = useDebouncedCallback((val: string) => setParam('q', val.trim() || null), 300)

  const activeCount = BOARD_FILTER_KEYS.filter(k => params.has(k)).length

  const clearAll = () => {
    setSearchValue('')
    const next = new URLSearchParams(params.toString())
    for (const key of BOARD_FILTER_KEYS) next.delete(key)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex flex-wrap gap-2.5 items-center mb-6">
      <div className="relative max-w-xs w-full sm:w-64">
        <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <Input
          placeholder="Search tickets…"
          aria-label="Search tickets"
          value={searchValue}
          onChange={e => {
            const val = e.target.value
            setSearchValue(val)
            setSearchParam(val)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') setSearchParam.flush(searchValue)
          }}
          className="pl-8 h-8 text-xs bg-card"
        />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {CHIPS.map(chip => {
          const active = params.get(chip.key) === '1'
          return (
            <Badge
              key={chip.key}
              variant={active ? 'default' : 'outline'}
              role="button"
              aria-pressed={active}
              tabIndex={0}
              className={`cursor-pointer text-xs transition-colors py-1 px-2.5 font-normal select-none ${
                active
                  ? 'bg-teal-500 hover:bg-teal-600 text-white border-teal-500'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              onClick={() => setParam(chip.key, active ? null : '1')}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setParam(chip.key, active ? null : '1')
                }
              }}
            >
              {chip.label}
            </Badge>
          )
        })}

        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 ml-1 transition-colors"
          >
            <XIcon className="w-3 h-3" aria-hidden /> Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
