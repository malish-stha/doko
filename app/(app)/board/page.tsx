import { Suspense } from 'react'
import { BoardClient, BoardSkeleton } from '@/components/board/BoardClient'
import { SignOutButton } from '@/components/SignOutButton'

export const dynamic = 'force-dynamic'

export default function BoardPage() {
  return (
    <div className="relative min-h-screen pb-16">
      <Suspense fallback={<BoardSkeleton />}>
        <BoardClient />
      </Suspense>
      <div className="fixed bottom-4 right-4 z-40">
        <SignOutButton />
      </div>
    </div>
  )
}

