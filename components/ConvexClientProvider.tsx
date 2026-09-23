'use client'

import { ReactNode, useCallback, useMemo } from 'react'
import { ConvexReactClient, ConvexProviderWithAuth } from 'convex/react'
import { useSession } from 'next-auth/react'

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * Bridges the next-auth session to Convex. The hook identity only changes
 * when the signed-in email changes, so Convex does not re-fetch in a loop.
 */
function useAuthFromNextAuth() {
  const { status, data } = useSession()
  const email = data?.user?.email ?? null

  const fetchAccessToken = useCallback(async () => {
    if (!email) return null
    try {
      const res = await fetch('/api/convex-token', { cache: 'no-store' })
      if (!res.ok) return null
      const body = (await res.json()) as { token?: string | null }
      return body.token ?? null
    } catch (error) {
      console.error('[convex-auth] failed to fetch access token:', error)
      return null
    }
  }, [email])

  return useMemo(
    () => ({
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      fetchAccessToken,
    }),
    [status, fetchAccessToken],
  )
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useAuthFromNextAuth}>
      {children}
    </ConvexProviderWithAuth>
  )
}
