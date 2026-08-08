import { Suspense } from 'react'
import { TicketsListClient } from '@/components/tickets-list/TicketsListClient'
import { Skeleton } from '@/components/ui/skeleton'

export default function TicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4 max-w-7xl mx-auto">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <TicketsListClient />
    </Suspense>
  )
}
