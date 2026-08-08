'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Input } from '@/components/ui/input'
import { PriorityPill } from './PriorityPill'
import Link from 'next/link'
import type { Doc } from '@/convex/_generated/dataModel'
import { GripVerticalIcon, UserCheckIcon } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'

const TYPE_BADGE: Record<string, string> = {
  bug: 'bg-red-500/10 text-red-400 border-red-500/20',
  feature: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  task: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  epic: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
}

export function BacklogTicketRow({ ticket }: { ticket: Doc<'tickets'> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: ticket._id })

  const updateTicket = useMutation(api.tickets.update)
  const [ptsValue, setPtsValue] = useState<string>(
    ticket.storyPoints != null ? String(ticket.storyPoints) : '',
  )

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const handlePtsBlur = async () => {
    if (ptsValue === '') {
      if (ticket.storyPoints !== undefined) {
        try {
          await updateTicket({ id: ticket._id, storyPoints: null })
        } catch (err: any) {
          toast.error('Failed to update story points', parseConvexError(err))
        }
      }
      return
    }

    const val = parseFloat(ptsValue)
    if (Number.isFinite(val) && val >= 0 && val !== ticket.storyPoints) {
      try {
        await updateTicket({ id: ticket._id, storyPoints: val })
      } catch (err: any) {
        toast.error('Failed to update story points', parseConvexError(err))
      }
    }
  }

  const assigneeLabel = ticket.assigneeId
    ? ticket.assigneeId.includes('@')
      ? ticket.assigneeId.split('@')[0]
      : ticket.assigneeId.slice(0, 10)
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-2.5 bg-card/80 border-b border-border/40 hover:bg-muted/40 transition-colors select-none ${
        isDragging ? 'opacity-40 z-50 shadow-md bg-teal-500/10' : ''
      }`}
    >
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground p-0.5"
      >
        <GripVerticalIcon className="w-4 h-4" />
      </div>

      <Link
        href={`/tickets/${ticket.key}`}
        className="font-mono text-xs text-muted-foreground hover:text-foreground w-16 shrink-0"
      >
        {ticket.key}
      </Link>

      <span
        className={`text-[10px] px-1.5 py-0.5 border font-mono uppercase tracking-wider shrink-0 ${
          TYPE_BADGE[ticket.type] ?? ''
        }`}
      >
        {ticket.type}
      </span>

      <Link
        href={`/tickets/${ticket.key}`}
        className="flex-1 text-sm font-medium truncate hover:text-teal-400 transition-colors"
      >
        {ticket.title}
      </Link>

      <PriorityPill priority={ticket.priority} />

      {assigneeLabel && (
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 border border-teal-500/30 text-teal-400 bg-teal-500/10 shrink-0">
          <UserCheckIcon className="w-2.5 h-2.5" />
          {assigneeLabel}
        </span>
      )}

      <Input
        type="number"
        step="0.5"
        min={0}
        max={100}
        value={ptsValue}
        onChange={e => setPtsValue(e.target.value)}
        onBlur={handlePtsBlur}
        placeholder="pts"
        className="w-16 h-7 text-xs font-mono text-center shrink-0 border-border/60"
      />
    </div>
  )
}
