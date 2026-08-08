'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'
import type { Doc } from '@/convex/_generated/dataModel'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export function SprintCard({
  sprint,
  tickets,
}: {
  sprint: Doc<'sprints'>
  tickets: Doc<'tickets'>[]
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `sprint:${sprint._id}`,
  })

  const startSprint = useMutation(api.sprints.start)
  const completeSprint = useMutation(api.sprints.complete)

  const [completing, setCompleting] = useState(false)
  const [loading, setLoading] = useState(false)

  const totalPoints = tickets.reduce(
    (sum, t) => sum + (t.storyPoints ?? 0),
    0,
  )

  const completedPoints = tickets
    .filter(t => t.status === 'done')
    .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)

  const handleStart = async () => {
    setLoading(true)
    try {
      await startSprint({ sprintId: sprint._id, durationDays: 14 })
      toast.success('Sprint started', `Sprint "${sprint.name}" is now active.`)
    } catch (err: any) {
      toast.error('Cannot start sprint', parseConvexError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async (rolloverTarget: 'backlog') => {
    setLoading(true)
    try {
      await completeSprint({
        sprintId: sprint._id,
        rollover: rolloverTarget,
      })
      toast.success('Sprint completed', `Sprint "${sprint.name}" finished!`)
      setCompleting(false)
    } catch (err: any) {
      toast.error('Cannot complete sprint', parseConvexError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div
        ref={setNodeRef}
        className={`min-w-[260px] max-w-[320px] p-4 border transition-all duration-150 rounded-none bg-card flex flex-col justify-between ${
          isOver
            ? 'border-teal-500 bg-teal-500/5 ring-1 ring-teal-500/30'
            : sprint.status === 'active'
              ? 'border-teal-500/50 shadow-xs'
              : 'border-border/80'
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h3 className="text-sm font-semibold tracking-tight truncate">
              {sprint.name}
            </h3>
            {sprint.status === 'active' ? (
              <span className="text-[10px] px-2 py-0.5 font-mono font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30">
                ACTIVE
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 font-mono text-muted-foreground bg-muted border border-border">
                PLANNING
              </span>
            )}
          </div>

          {sprint.goal && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              {sprint.goal}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono my-2">
            <span>{tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}</span>
            <span>·</span>
            <span className="font-semibold text-foreground">
              {sprint.status === 'active' ? `${completedPoints}/` : ''}{totalPoints} pts
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-border/40 mt-3">
          {sprint.status === 'planning' && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs hover:border-teal-500/50 hover:text-teal-400"
              onClick={handleStart}
              disabled={loading}
            >
              {loading ? 'Starting...' : 'Start Sprint'}
            </Button>
          )}

          {sprint.status === 'active' && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs border-teal-500/30 text-teal-400 hover:bg-teal-500/10"
              onClick={() => setCompleting(true)}
              disabled={loading}
            >
              Complete Sprint
            </Button>
          )}
        </div>
      </div>

      <Dialog open={completing} onOpenChange={setCompleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Sprint "{sprint.name}"?</DialogTitle>
            <DialogDescription>
              Any incomplete tickets will automatically be moved back to the backlog.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCompleting(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleComplete('backlog')}>
              Complete & Rollover to Backlog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
