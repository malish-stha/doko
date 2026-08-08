'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Doc } from '@/convex/_generated/dataModel'

export function EpicPicker({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (epicId: string | undefined) => void
}) {
  const epics = useQuery(api.tickets.listEpics) ?? []

  return (
    <Select
      value={(value ?? 'none') as any}
      onValueChange={(val: any) =>
        onChange(!val || val === 'none' ? undefined : val)
      }
    >
      <SelectTrigger className="w-full text-xs font-mono bg-card border-border/80">
        <SelectValue placeholder="Select parent epic (optional)..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None (No Parent Epic)</SelectItem>
        {epics.map((epic: Doc<'tickets'>) => (
          <SelectItem key={epic._id} value={epic._id}>
            {epic.key} — {epic.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
