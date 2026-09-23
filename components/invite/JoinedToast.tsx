'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/components/ui/toast'

/** Shows a one-time toast after /invite/accept redirects here with ?joined=<team>. */
export function JoinedToast() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const joined = params.get('joined')

  useEffect(() => {
    if (!joined) return
    toast.success('Welcome aboard!', `You have joined ${joined}.`)
    const rest = new URLSearchParams(params.toString())
    rest.delete('joined')
    const qs = rest.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [joined, params, pathname, router])

  return null
}
