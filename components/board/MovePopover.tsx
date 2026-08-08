'use client'

import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import type { Id } from '@/convex/_generated/dataModel'

export function MovePopover({
  open,
  onOpenChange,
  targetIds,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetIds: Id<'tickets'>[]
  onSuccess?: () => void
}) {
  const bulkUpdateStatus = useMutation(api.tickets.bulkUpdateStatus)

  if (targetIds.length === 0) return null

  const STATUSES = [
    { value: 'backlog', label: 'Backlog' },
    { value: 'todo', label: 'Todo' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'review', label: 'Review' },
    { value: 'done', label: 'Done' },
  ] as const

  const handleMove = async (status: (typeof STATUSES)[number]['value']) => {
    try {
      await bulkUpdateStatus({ ticketIds: targetIds, status })
      toast.success(`Moved ${targetIds.length} ticket${targetIds.length > 1 ? 's' : ''} to ${status}`)
      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      toast.error('Failed to move tickets', err?.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Move {targetIds.length} Ticket{targetIds.length > 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 mt-2">
          {STATUSES.map(s => (
            <Button
              key={s.value}
              variant="outline"
              className="w-full justify-start text-xs font-normal"
              onClick={() => handleMove(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
