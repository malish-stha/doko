'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { useRouter } from 'next/navigation'
import { toast } from '@/components/ui/toast'

export function CreateTicketFromMessageDialog({
  open,
  onOpenChange,
  message,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  message: Doc<'messages'>
}) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const members = useQuery(api.tickets.listAssignableMembers, userEmail ? { userEmail } : {}) ?? []

  const [type, setType] = useState<'bug' | 'feature' | 'task' | 'epic'>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [assigneeId, setAssigneeId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const create = useMutation(api.tickets.create)
  const router = useRouter()

  useEffect(() => {
    if (open && message) {
      const preview =
        message.body.slice(0, 60) + (message.body.length > 60 ? '…' : '')
      setTitle(preview)
      setDescription(message.body)
      setType('bug')
      setPriority('medium')
      setAssigneeId('')
    }
  }, [open, message])

  const submit = async () => {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await create({
        projectId: 'doko',
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assigneeId: assigneeId || undefined,
        sourceMessageId: message._id,
      })
      toast.success('Ticket created from message', `"${title.trim()}" created.`)
      onOpenChange(false)
      if (res?.key) {
        router.push(`/tickets/${res.key}`)
      }
    } catch (err: any) {
      console.error('Failed to create ticket from message:', err)
      toast.error('Failed to create ticket', err?.message ?? 'Could not create ticket from message.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create ticket from message</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">
                Type
              </label>
              <Select value={type} onValueChange={v => setType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="epic">Epic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">
                Priority
              </label>
              <Select value={priority} onValueChange={v => setPriority(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">
              Assignee (optional)
            </label>
            <Select value={assigneeId || 'unassigned'} onValueChange={(v: string | null) => setAssigneeId(!v || v === 'unassigned' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {members.map(m => (
                  <SelectItem key={m.userId || m.email} value={m.userId || m.email}>
                    {m.name} ({m.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">
              Title
            </label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ticket title…"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">
              Description
            </label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Ticket description…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim() || submitting}>
            {submitting ? 'Creating…' : 'Create ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

