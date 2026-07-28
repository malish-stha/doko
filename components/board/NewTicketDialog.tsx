'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
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
import { toast } from '@/components/ui/toast'
import { ImageIcon, UploadIcon, XIcon } from 'lucide-react'

export function NewTicketDialog({ projectId }: { projectId: string }) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const members = useQuery(api.tickets.listAssignableMembers, userEmail ? { userEmail } : {}) ?? []

  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'bug' | 'feature' | 'task' | 'epic'>('task')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [assigneeId, setAssigneeId] = useState<string>('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const create = useMutation(api.tickets.create)
  const generateUploadUrl = useMutation(api.tickets.generateUploadUrl)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const postUrl = await generateUploadUrl()
      const result = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!result.ok) throw new Error('Upload failed')
      const { storageId } = await result.json()

      setAttachments(prev => [...prev, storageId])
      toast.success('Image attached', file.name)
    } catch (err: any) {
      console.error('File upload error:', err)
      toast.error('Upload failed', err?.message ?? 'Failed to attach image')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (storageId: string) => {
    setAttachments(prev => prev.filter(id => id !== storageId))
  }

  const submit = async () => {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await create({
        projectId,
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assigneeId: assigneeId || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      })
      toast.success('Ticket created', `"${title.trim()}" created successfully.`)
      setTitle('')
      setDescription('')
      setType('task')
      setPriority('medium')
      setAssigneeId('')
      setAttachments([])
      setOpen(false)
    } catch (err: any) {
      console.error('Failed to create ticket:', err)
      toast.error('Failed to create ticket', err?.message ?? 'An error occurred while creating the ticket.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">New ticket</Button>} />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New ticket</DialogTitle>
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
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
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
              placeholder="What needs to be done?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">
              Description (optional)
            </label>
            <Textarea
              placeholder="Add details, context, or acceptance criteria…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Image Attachments */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                <ImageIcon className="w-3 h-3" />
                Image Attachments ({attachments.length})
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-6 text-[11px] gap-1 px-2"
              >
                <UploadIcon className="w-3 h-3" />
                {uploading ? 'Uploading…' : 'Attach Image'}
              </Button>
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachments.map(storageId => (
                  <div
                    key={storageId}
                    className="relative flex items-center gap-1 text-[11px] bg-muted px-2 py-1 border font-mono"
                  >
                    <span>Image attached</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(storageId)}
                      className="text-muted-foreground hover:text-red-400"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim() || submitting || uploading}>
            {submitting ? 'Creating…' : 'Create ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

