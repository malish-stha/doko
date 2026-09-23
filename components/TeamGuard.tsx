'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Redirects to onboarding only when the signed-in user belongs to no team at
 * all. Users with memberships but no active pointer are served their earliest
 * membership by the server, so they never bounce to onboarding.
 * Must render inside ConvexAuthGate so the query runs with a verified identity.
 */
export function TeamGuard({ children }: { children: React.ReactNode }) {
  const teams = useQuery(api.teams.myTeams, {})
  const router = useRouter()
  const pathname = usePathname()

  const needsOnboarding =
    teams !== undefined && teams.length === 0 && !pathname.startsWith('/onboarding')

  useEffect(() => {
    if (needsOnboarding) {
      router.replace('/onboarding')
    }
  }, [needsOnboarding, router])

  if (needsOnboarding) {
    return null
  }

  return <>{children}</>
}
