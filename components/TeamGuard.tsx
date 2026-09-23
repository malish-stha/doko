'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Redirects to onboarding when the signed-in user has no team. Must be
 * rendered inside ConvexAuthGate so the query runs with a verified identity.
 */
export function TeamGuard({ children }: { children: React.ReactNode }) {
  const team = useQuery(api.teams.myTeam, {})
  const router = useRouter()
  const pathname = usePathname()

  const needsOnboarding = team === null && !pathname.startsWith('/onboarding')

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
