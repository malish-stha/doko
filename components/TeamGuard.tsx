'use client'

import { useQuery } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

export function TeamGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const team = useQuery(api.teams.myTeam, userEmail ? { userEmail } : 'skip')
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (team === null && !pathname.startsWith('/onboarding')) {
      router.replace('/onboarding')
    }
  }, [team, pathname, router])

  if (team === undefined) {
    return <div className="p-8 text-xs font-mono animate-pulse text-muted-foreground">Loading team context…</div>
  }

  if (team === null && !pathname.startsWith('/onboarding')) {
    return null
  }

  return <>{children}</>
}
