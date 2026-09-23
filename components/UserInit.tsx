'use client'

import { useEffect, useRef } from 'react'
import { useConvexAuth, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'

/**
 * Ensures the caller has a `users` row. Runs once per authenticated session;
 * identity (email, name) comes from the verified token, the client only
 * contributes its timezone.
 */
export function UserInit() {
  const { isAuthenticated } = useConvexAuth()
  const upsert = useMutation(api.users.upsert)
  const ran = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || ran.current) return
    ran.current = true

    let timezone = 'UTC'
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch (e) {
      console.error('Timezone detection error:', e)
    }

    upsert({ timezone }).catch(err => {
      ran.current = false
      console.error('Failed to upsert user info:', err)
    })
  }, [isAuthenticated, upsert])

  return null
}
