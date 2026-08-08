'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'

export function NewSprintDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: session } = useSession()
  const createSprint = useMutation(api.sprints.create)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      await createSprint({
        name: name.trim(),
        goal: goal.trim() || undefined,
        userEmail: session?.user?.email ?? undefined,
      })
      toast.success('Sprint created', `Sprint "${name.trim()}" created successfully.`)
      setName('')
      setGoal('')
      onOpenChange(false)
    } catch (err: any) {
      toast.error('Failed to create sprint', parseConvexError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Sprint</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Sprint Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Sprint 4 - Auth Polish"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Sprint Goal (Optional)
              </label>
              <Textarea
                placeholder="What is the objective for this sprint?"
                value={goal}
                onChange={e => setGoal(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || submitting}>
              {submitting ? 'Creating...' : 'Create Sprint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
