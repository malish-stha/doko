import { Suspense } from 'react'
import { BoardClient, BoardSkeleton } from '@/components/board/BoardClient'

export const dynamic = 'force-dynamic'

export default function BoardPage() {
  return (
    <div className="relative min-h-screen pb-16">
      <Suspense fallback={<BoardSkeleton />}>
        <BoardClient />
      </Suspense>
    </div>
  )
}
