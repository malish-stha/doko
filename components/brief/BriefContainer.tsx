'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { BriefCard } from './BriefCard'
import { BriefEmptyState } from './BriefEmptyState'

export function BriefContainer() {
  const brief = useQuery(api.brief.todayForMe)

  if (brief === undefined) {
    return <div className="h-64 animate-pulse bg-muted/20 border" />
  }

  if (brief === null) {
    return <BriefEmptyState />
  }

  return <BriefCard brief={brief} />
}
