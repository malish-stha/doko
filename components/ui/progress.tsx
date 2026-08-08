'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export function Progress({
  value = 0,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value?: number }) {
  const percentage = Math.min(100, Math.max(0, value))
  return (
    <div
      className={cn(
        'relative h-2 w-full overflow-hidden bg-muted/60 rounded-none border border-border/40',
        className,
      )}
      {...props}
    >
      <div
        className="h-full bg-teal-500 transition-all duration-300 ease-in-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
