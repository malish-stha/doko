import { BoardClient } from '@/components/board/BoardClient'
import { SignOutButton } from '@/components/SignOutButton'

export default function BoardPage() {
  return (
    <div className="relative min-h-screen pb-16">
      <BoardClient />
      <div className="fixed bottom-4 right-4 z-40">
        <SignOutButton />
      </div>
    </div>
  )
}
