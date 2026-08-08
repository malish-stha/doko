'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import type { Id } from '@/convex/_generated/dataModel'

export function BulkActionBar({
  selectedIds,
  onClear,
}: {
  selectedIds: Set<Id<'tickets'>>
  onClear: () => void
}) {
  const bulkUpdateStatus = useMutation(api.tickets.bulkUpdateStatus)
  const bulkUpdateAssignee = useMutation(api.tickets.bulkUpdateAssignee)
  const bulkUpdatePriority = useMutation(api.tickets.bulkUpdatePriority)
  const bulkDelete = useMutation(api.tickets.bulkDelete)

  const teamMembers = useQuery(api.teamMembers.listForTeam, {}) ?? []
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  const ids = Array.from(selectedIds)
  if (ids.length === 0) return null

  const handleStatusChange = async (val: string | null) => {
    if (!val) return
    setIsBusy(true)
    try {
      await bulkUpdateStatus({ ticketIds: ids, status: val as any })
      toast.success(`Updated status for ${ids.length} tickets`)
    } catch (err: any) {
      toast.error('Failed to update status', err?.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handlePriorityChange = async (val: string | null) => {
    if (!val) return
    setIsBusy(true)
    try {
      await bulkUpdatePriority({ ticketIds: ids, priority: val as any })
      toast.success(`Updated priority for ${ids.length} tickets`)
    } catch (err: any) {
      toast.error('Failed to update priority', err?.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleAssigneeChange = async (val: string | null) => {
    if (!val) return
    setIsBusy(true)
    try {
      const assigneeId = val === 'unassigned' ? undefined : val
      await bulkUpdateAssignee({ ticketIds: ids, assigneeId })
      toast.success(`Updated assignee for ${ids.length} tickets`)
    } catch (err: any) {
      toast.error('Failed to update assignee', err?.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleDelete = async () => {
    setIsBusy(true)
    try {
      await bulkDelete({ ticketIds: ids })
      toast.success(`Deleted ${ids.length} tickets`)
      onClear()
    } catch (err: any) {
      toast.error('Failed to delete tickets', err?.message)
    } finally {
      setIsBusy(false)
      setConfirmDeleteOpen(false)
    }
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-lg animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="text-xs font-semibold px-2 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded">
          {ids.length} selected
        </div>

        <Select onValueChange={handleStatusChange} disabled={isBusy}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Move to..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="backlog">Backlog</SelectItem>
            <SelectItem value="todo">Todo</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>

        <Select onValueChange={handleAssigneeChange} disabled={isBusy}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Assign to..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {teamMembers.map(m => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.name ?? m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={handlePriorityChange} disabled={isBusy}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder="Priority..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>

        <div className="h-4 w-px bg-border my-auto" />

        <Button
          variant="destructive"
          size="sm"
          className="h-8 text-xs px-3"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={isBusy}
        >
          Delete
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground"
          onClick={onClear}
          disabled={isBusy}
        >
          Clear
        </Button>
      </div>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Tickets</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {ids.length} selected tickets? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isBusy}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
