import { auth } from '@/auth'
import { SignOutButton } from '@/components/SignOutButton'

export default async function BoardPage() {
  const session = await auth()
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {session?.user?.name || 'Teammate'}</h1>
          <p className="text-muted-foreground mt-1">{session?.user?.email}</p>
        </div>
        <SignOutButton />
      </div>
      <div className="p-6 border rounded-lg bg-card text-card-foreground">
        <h2 className="text-lg font-semibold mb-2">Phase 1 Complete</h2>
        <p className="text-sm text-muted-foreground">
          Auth & Convex integration are active. Board implementation arrives in Phase 2.
        </p>
      </div>
    </main>
  )
}
