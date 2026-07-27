'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SearchIcon, XIcon } from 'lucide-react'

type Chip = { key: string; label: string }
const CHIPS: Chip[] = [
  { key: 'mine', label: 'My tickets' },
  { key: 'hipri', label: 'High+ priority' },
  { key: 'dueThisWeek', label: 'Due this week' },
]

export function BoardFilters() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const qParam = params.get('q') ?? ''
  const [searchValue, setSearchValue] = useState(qParam)

  useEffect(() => {
    setSearchValue(params.get('q') ?? '')
  }, [params])

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
    router.push(`${pathname}?${next.toString()}`)
  }

  const activeCount = Array.from(params.keys()).filter(
    k => k === 'q' || k === 'mine' || k === 'hipri' || k === 'dueThisWeek',
  ).length

  const clearAll = () => {
    setSearchValue('')
    router.push(pathname)
  }

  return (
    <div className="flex flex-wrap gap-2.5 items-center mb-6">
      <div className="relative max-w-xs w-full sm:w-64">
        <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search tickets…"
          value={searchValue}
          onChange={e => {
            const val = e.target.value
            setSearchValue(val)
            setParam('q', val.trim() || null)
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
              className={`cursor-pointer text-xs transition-colors py-1 px-2.5 font-normal select-none ${
                active
                  ? 'bg-teal-500 hover:bg-teal-600 text-white border-teal-500'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              onClick={() => setParam(chip.key, active ? null : '1')}
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
            <XIcon className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
