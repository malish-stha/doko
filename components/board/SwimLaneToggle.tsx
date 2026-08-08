'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { LayersIcon } from 'lucide-react'

export type SwimLaneMode = 'none' | 'assignee' | 'epic' | 'priority'

export function SwimLaneToggle() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentMode = (searchParams.get('lanes') as SwimLaneMode) || 'none'

  const handleModeChange = (mode: SwimLaneMode) => {
    const params = new URLSearchParams(searchParams.toString())
    if (mode === 'none') {
      params.delete('lanes')
    } else {
      params.set('lanes', mode)
    }
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1.5 border border-border/60 rounded-md p-0.5 bg-muted/20 text-xs">
      <div className="flex items-center gap-1 px-2 text-muted-foreground font-medium">
        <LayersIcon className="w-3.5 h-3.5" />
        <span>Lanes:</span>
      </div>
      {(['none', 'assignee', 'epic', 'priority'] as const).map(mode => {
        const active = currentMode === mode
        return (
          <button
            key={mode}
            type="button"
            onClick={() => handleModeChange(mode)}
            className={`px-2.5 py-1 rounded transition-colors font-medium capitalize ${
              active
                ? 'bg-card text-foreground shadow-xs border border-border/40 font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {mode === 'none' ? 'Off' : mode}
          </button>
        )
      })}
    </div>
  )
}
