'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Skeleton } from '@/components/ui/skeleton'
import { BriefCard } from './BriefCard'
import { BriefEmptyState } from './BriefEmptyState'

export function BriefContainer() {
  const brief = useQuery(api.brief.todayForMe)

  if (brief === undefined) {
    return (
      <div className="rounded-none border border-border/40 bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-5 w-24 rounded-none" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <div className="pt-4 flex gap-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    )
  }

  if (brief === null) {
    return <BriefEmptyState />
  }

  return <BriefCard brief={brief} />
}
