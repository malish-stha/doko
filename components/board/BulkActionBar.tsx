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
import { parseConvexError } from '@/lib/utils'
import type { Doc, Id } from '@/convex/_generated/dataModel'

type Status = Doc<'tickets'>['status']
type Priority = Doc<'tickets'>['priority']

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
  // Controlled selects, reset after each action so a stale value is never shown.
  const [statusValue, setStatusValue] = useState<string>('')
  const [assigneeValue, setAssigneeValue] = useState<string>('')
  const [priorityValue, setPriorityValue] = useState<string>('')

  const ids = Array.from(selectedIds)
  if (ids.length === 0) return null

  const run = async (label: string, action: () => Promise<unknown>) => {
    setIsBusy(true)
    try {
      await action()
      toast.success(`${label} for ${ids.length} ticket${ids.length === 1 ? '' : 's'}`)
      onClear()
    } catch (err) {
      toast.error(`Failed to ${label.toLowerCase()}`, parseConvexError(err))
    } finally {
      setIsBusy(false)
      setStatusValue('')
      setAssigneeValue('')
      setPriorityValue('')
    }
  }

  const handleStatusChange = (val: string | null) => {
    if (!val) return
    setStatusValue(val)
    void run('Updated status', () => bulkUpdateStatus({ ticketIds: ids, status: val as Status }))
  }

  const handlePriorityChange = (val: string | null) => {
    if (!val) return
    setPriorityValue(val)
    void run('Updated priority', () => bulkUpdatePriority({ ticketIds: ids, priority: val as Priority }))
  }

  const handleAssigneeChange = (val: string | null) => {
    if (!val) return
    setAssigneeValue(val)
    const assigneeId = val === 'unassigned' ? null : val
    void run('Updated assignee', () => bulkUpdateAssignee({ ticketIds: ids, assigneeId }))
  }

  const handleDelete = async () => {
    setConfirmDeleteOpen(false)
    await run('Deleted', () => bulkDelete({ ticketIds: ids }))
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="Bulk actions"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-lg animate-in fade-in slide-in-from-bottom-4 duration-200"
      >
        <div className="text-xs font-semibold px-2 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded">
          {ids.length} selected
        </div>

        <Select value={statusValue} onValueChange={handleStatusChange} disabled={isBusy}>
          <SelectTrigger className="h-8 w-32 text-xs" aria-label="Move selected tickets to status">
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

        <Select value={assigneeValue} onValueChange={handleAssigneeChange} disabled={isBusy}>
          <SelectTrigger className="h-8 w-36 text-xs" aria-label="Assign selected tickets">
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

        <Select value={priorityValue} onValueChange={handlePriorityChange} disabled={isBusy}>
          <SelectTrigger className="h-8 w-28 text-xs" aria-label="Set priority for selected tickets">
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
              Are you sure you want to delete {ids.length} selected ticket{ids.length === 1 ? '' : 's'}? Comments,
              subtasks and attachments go with them. This cannot be undone.
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
