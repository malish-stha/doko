'use client'

import { useEffect } from 'react'
import { useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'

export function UserInit() {
  const { data: session } = useSession()
  const upsert = useMutation(api.users.upsert)

  useEffect(() => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const email = session?.user?.email ?? undefined
      const name = session?.user?.name ?? undefined

      upsert({ timezone, email, name }).catch(err => {
        console.error('Failed to upsert user info:', err)
      })
    } catch (e) {
      console.error('Timezone/user detection error:', e)
    }
  }, [upsert, session])

  return null
}
