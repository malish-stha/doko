'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { StatusPill } from './StatusPill'

export function EpicChildrenTable({ epicId }: { epicId: Id<'tickets'> }) {
  const children = useQuery(api.tickets.epicChildren, { epicId }) ?? []

  const totalPts = children.reduce(
    (sum, c) => sum + (c.storyPoints ?? 0),
    0,
  )

  const donePts = children
    .filter(c => c.status === 'done')
    .reduce((sum, c) => sum + (c.storyPoints ?? 0), 0)

  const doneCount = children.filter(c => c.status === 'done').length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
        <span className="font-semibold uppercase tracking-wider text-foreground">
          Child Tickets ({children.length})
        </span>
        <span>
          <strong className="text-foreground">{doneCount}/{children.length}</strong> done ·{' '}
          <strong className="text-foreground">{donePts}/{totalPts}</strong> pts
        </span>
      </div>

      {children.length === 0 ? (
        <div className="p-6 border border-dashed border-border/60 text-center text-xs text-muted-foreground">
          No child tickets associated with this epic yet. Assign tickets to this epic when creating or editing them.
        </div>
      ) : (
        <div className="border border-border/80 overflow-x-auto bg-card">
          <table className="w-full text-xs font-mono">
            <thead className="bg-muted/40 text-muted-foreground text-left border-b border-border/80">
              <tr>
                <th className="py-2 px-3 font-medium">Key</th>
                <th className="py-2 px-3 font-medium">Title</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium">Assignee</th>
                <th className="py-2 px-3 font-medium text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {children.map(c => {
                const assigneeLabel = c.assigneeId
                  ? c.assigneeId.includes('@')
                    ? c.assigneeId.split('@')[0]
                    : c.assigneeId.slice(0, 10)
                  : '—'

                return (
                  <tr key={c._id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-3 text-muted-foreground">{c.key}</td>
                    <td className="py-2 px-3 font-sans font-medium">
                      <Link
                        href={`/tickets/${c.key}`}
                        className="hover:text-teal-400 transition-colors"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="py-2 px-3">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{assigneeLabel}</td>
                    <td className="py-2 px-3 text-right font-semibold">
                      {c.storyPoints != null ? `${c.storyPoints} pts` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-muted/20 border-t border-border/80 font-bold">
              <tr>
                <td colSpan={4} className="py-2 px-3 text-right text-muted-foreground">
                  Subtotal Rollup:
                </td>
                <td className="py-2 px-3 text-right text-teal-400">
                  {donePts} / {totalPts} pts
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
