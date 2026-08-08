'use client'

import { useHotkey } from '@/lib/hotkeys'
import { useRouter } from 'next/navigation'

export function GlobalHotkeys() {
  const router = useRouter()

  useHotkey('g b', () => router.push('/board'), {
    description: 'Go to Board',
    scope: 'Global Navigation',
  })

  useHotkey('g l', () => router.push('/backlog'), {
    description: 'Go to Backlog',
    scope: 'Global Navigation',
  })

  useHotkey('g e', () => router.push('/epics'), {
    description: 'Go to Epics',
    scope: 'Global Navigation',
  })

  useHotkey('g i', () => router.push('/inbox'), {
    description: 'Go to Inbox',
    scope: 'Global Navigation',
  })

  useHotkey('g t', () => router.push('/tickets'), {
    description: 'Go to Tickets List',
    scope: 'Global Navigation',
  })

  return null
}
