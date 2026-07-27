'use client'

import { useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'

export function UserInit() {
  const upsert = useMutation(api.users.upsert)

  useEffect(() => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      upsert({ timezone }).catch(err => {
        console.error('Failed to upsert user timezone:', err)
      })
    } catch (e) {
      console.error('Timezone detection error:', e)
    }
  }, [upsert])

  return null
}
