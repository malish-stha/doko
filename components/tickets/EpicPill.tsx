'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import type { Id } from '@/convex/_generated/dataModel'
import { LayersIcon } from 'lucide-react'

export function EpicPill({ epicId }: { epicId: Id<'tickets'> }) {
  const allTickets = useQuery(api.tickets.list, { projectId: 'doko' }) ?? []
  const epic = allTickets.find(t => t._id === epicId)

  if (!epic) return null

  return (
    <Link
      href={`/tickets/${epic.key}`}
      className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 border border-teal-500/30 text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 transition-colors"
    >
      <LayersIcon className="w-3 h-3 shrink-0 text-teal-400" />
      <span>Epic: {epic.key} · {epic.title}</span>
    </Link>
  )
}
