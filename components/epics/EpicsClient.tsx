'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { PriorityPill } from '@/components/backlog/PriorityPill'
import { Skeleton } from '@/components/ui/skeleton'
import { NewTicketDialog } from '@/components/board/NewTicketDialog'
import type { Doc } from '@/convex/_generated/dataModel'

export function EpicsSkeleton() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div className="space-y-1">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  )
}

export function EpicsClient() {
  const epics = useQuery(api.tickets.listEpics)
  const allTickets = useQuery(api.tickets.list, { projectId: 'doko' }) ?? []

  if (epics === undefined) {
    return <EpicsSkeleton />
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Epics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            High-level features, themes, and milestone initiatives.
          </p>
        </div>
        <NewTicketDialog projectId="doko" />
      </div>

      {epics.length === 0 ? (
        <div className="p-12 border border-dashed border-border/60 text-center rounded-none bg-card/20 space-y-3">
          <p className="text-sm font-medium">No epics created yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Epics allow you to group related tickets and track feature progress. Click "New ticket" and select type "Epic".
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {epics.map(epic => (
            <EpicCard key={epic._id} epic={epic} allTickets={allTickets} />
          ))}
        </div>
      )}
    </div>
  )
}

function EpicCard({
  epic,
  allTickets,
}: {
  epic: Doc<'tickets'>
  allTickets: Doc<'tickets'>[]
}) {
  const children = allTickets.filter(t => t.epicId === epic._id)
  const totalTickets = children.length
  const doneTickets = children.filter(t => t.status === 'done').length

  const totalPoints = children.reduce(
    (sum, t) => sum + (t.storyPoints ?? 0),
    0,
  )
  const donePoints = children
    .filter(t => t.status === 'done')
    .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)

  const ticketPercent =
    totalTickets > 0 ? (doneTickets / totalTickets) * 100 : 0
  const pointsPercent = totalPoints > 0 ? (donePoints / totalPoints) * 100 : 0

  return (
    <div className="p-5 border border-border/80 bg-card hover:border-teal-500/50 transition-colors space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {epic.key}
            </span>
            <PriorityPill priority={epic.priority} />
          </div>
          <h2 className="text-base font-semibold tracking-tight hover:text-teal-400 transition-colors">
            <Link href={`/tickets/${epic.key}`}>{epic.title}</Link>
          </h2>
          {epic.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 pt-1">
              {epic.description.replace(/<[^>]*>/g, '')}
            </p>
          )}
        </div>

        <Link
          href={`/tickets/${epic.key}`}
          className="text-xs font-mono text-teal-400 hover:underline shrink-0 pt-1"
        >
          View Epic Details →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono text-muted-foreground">
            <span>Ticket Progress</span>
            <span className="font-semibold text-foreground">
              {doneTickets}/{totalTickets} done ({Math.round(ticketPercent)}%)
            </span>
          </div>
          <Progress value={ticketPercent} />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono text-muted-foreground">
            <span>Points Rollup</span>
            <span className="font-semibold text-foreground">
              {donePoints}/{totalPoints} pts ({Math.round(pointsPercent)}%)
            </span>
          </div>
          <Progress value={pointsPercent} />
        </div>
      </div>
    </div>
  )
}
