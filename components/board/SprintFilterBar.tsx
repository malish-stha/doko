'use client'

import { useQuery } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Id, Doc } from '@/convex/_generated/dataModel'

export type SprintFilterValue = 'active' | 'all' | Id<'sprints'>

export function SprintFilterBar({
  value,
  onChange,
}: {
  value: SprintFilterValue
  onChange: (val: SprintFilterValue) => void
}) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const sprints = useQuery(api.sprints.listForTeam, userEmail ? { userEmail } : {}) ?? []
  const active = sprints.find((s: Doc<'sprints'>) => s.status === 'active')

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono uppercase text-muted-foreground shrink-0">
        Scope:
      </span>
      <Select
        value={value as any}
        onValueChange={(val: any) => onChange(val as SprintFilterValue)}
      >
        <SelectTrigger className="w-[240px] h-8 text-xs font-mono bg-card border-border/80">
          <SelectValue placeholder="Filter by sprint..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">
            {active ? `Active Sprint (${active.name})` : 'Active Sprint (None)'}
          </SelectItem>
          <SelectItem value="all">All Tickets (No Sprint Filter)</SelectItem>
          {sprints.map((s: Doc<'sprints'>) => (
            <SelectItem key={s._id} value={s._id}>
              {s.name} ({s.status.toUpperCase()})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
