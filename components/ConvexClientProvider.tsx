'use client'

import { ReactNode, useCallback, useMemo } from 'react'
import { ConvexReactClient, ConvexProviderWithAuth } from 'convex/react'

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

function useAuthFromNextAuth() {
  const fetchAccessToken = useCallback(async () => {
    try {
      const res = await fetch('/api/convex-token')
      if (!res.ok) return null
      const { token } = await res.json()
      return token as string | null
    } catch {
      return null
    }
  }, [])

  return useMemo(
    () => ({
      isLoading: false,
      isAuthenticated: true,
      fetchAccessToken,
    }),
    [fetchAccessToken],
  )
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useAuthFromNextAuth}>
      {children}
    </ConvexProviderWithAuth>
  )
}
