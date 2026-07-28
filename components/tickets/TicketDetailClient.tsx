'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { formatDistanceToNow } from 'date-fns'
import { ImageIcon, UploadIcon, XIcon, MessageSquareIcon, UserCheckIcon, AlertCircleIcon, UserIcon } from 'lucide-react'
import { CommentThread } from './CommentThread'

export function TicketDetailClient({ ticketKey }: { ticketKey: string }) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined

  const ticket = useQuery(api.tickets.getByKey, { key: ticketKey })
  const members = useQuery(api.tickets.listAssignableMembers, userEmail ? { userEmail } : {}) ?? []
  
  const update = useMutation(api.tickets.update)
  const assignMutation = useMutation(api.tickets.assign)
  const updateStatus = useMutation(api.tickets.updateStatus)
  const generateUploadUrl = useMutation(api.tickets.generateUploadUrl)

  const [uploading, setUploading] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentUserEmail = (session?.user?.email ?? '').trim().toLowerCase()
  const me = members.find(m => m.email.trim().toLowerCase() === currentUserEmail)
  const currentUserId = me?.userId ?? currentUserEmail

  const isAssignedToMe =
    !!ticket?.assigneeId &&
    (ticket.assigneeId === currentUserId ||
      ticket.assigneeId.trim().toLowerCase() === currentUserEmail)

  const assignedMember = members.find(
    m => m.userId === ticket?.assigneeId || m.email.trim().toLowerCase() === ticket?.assigneeId?.trim().toLowerCase(),
  )

  const reporterMember = members.find(
    m => m.userId === ticket?.reporterId || m.email.trim().toLowerCase() === ticket?.reporterId?.trim().toLowerCase(),
  )

  const handleAssign = async (targetAssigneeId: string | null | undefined) => {
    if (!ticket) return
    setAssignError(null)
    try {
      await assignMutation({
        id: ticket._id,
        assigneeId: targetAssigneeId || undefined,
        userEmail,
      })
    } catch (err: any) {
      setAssignError(err?.message ?? 'Failed to update assignment')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !ticket) return

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

      const currentAttachments = ticket.attachments ?? []
      await update({
        id: ticket._id,
        attachments: [...currentAttachments, storageId],
      })
    } catch (err) {
      console.error('File upload error:', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeAttachment = async (storageId: string) => {
    if (!ticket) return
    const updated = (ticket.attachments ?? []).filter(id => id !== storageId)
    await update({ id: ticket._id, attachments: updated })
  }

  if (ticket === undefined) {
    return (
      <div className="max-w-3xl mx-auto p-6 animate-pulse">
        <div className="h-4 w-20 bg-muted mb-4" />
        <div className="h-8 w-64 bg-muted mb-6" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="h-10 bg-muted" />
          <div className="h-10 bg-muted" />
          <div className="h-10 bg-muted" />
        </div>
        <div className="h-32 bg-muted" />
      </div>
    )
  }

  if (ticket === null) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center">
        <div className="text-xl font-medium mb-2">Ticket not found</div>
        <p className="text-sm text-muted-foreground mb-4">
          The ticket <span className="font-mono">{ticketKey}</span> does not exist or has been removed.
        </p>
        <Link href="/board" className="text-sm text-teal-400 hover:underline">
          ← Return to Board
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link
        href="/board"
        className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        ← Board
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-muted-foreground">{ticket.key}</span>
        <span className="text-[10px] px-1.5 py-0.5 border font-medium uppercase tracking-wider bg-muted text-muted-foreground">
          {ticket.type}
        </span>
      </div>

      {ticket.sourceMessageId && (
        <div className="mb-4 inline-flex items-center gap-1.5 text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1">
          <MessageSquareIcon className="w-3.5 h-3.5" />
          Created from{' '}
          <Link href="/chat" className="underline hover:text-teal-300 font-medium">
            a chat message
          </Link>
        </div>
      )}

      {assignError && (
        <div className="mb-4 p-3 text-xs font-mono bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-between rounded-none">
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="w-4 h-4 shrink-0" />
            <span>{assignError}</span>
          </div>
          <button type="button" onClick={() => setAssignError(null)} className="hover:text-white">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <Input
        key={`title-${ticket._id}-${ticket.title}`}
        defaultValue={ticket.title}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        onBlur={e => {
          const val = e.target.value.trim()
          if (val && val !== ticket.title) {
            update({ id: ticket._id, title: val })
          }
        }}
        className="text-2xl font-bold tracking-tight mb-6 border-0 focus-visible:ring-1 focus-visible:ring-teal-500/50 px-0 h-auto py-1"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-sm">
        <div>
          <label className="text-xs font-medium uppercase text-muted-foreground mb-1 block">
            Status
          </label>
          <Select
            value={ticket.status}
            onValueChange={v => updateStatus({ id: ticket._id, status: v as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="backlog">Backlog</SelectItem>
              <SelectItem value="todo">Todo</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium uppercase text-muted-foreground mb-1 block">
            Priority
          </label>
          <Select
            value={ticket.priority}
            onValueChange={v => update({ id: ticket._id, priority: v as any })}
          >
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

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium uppercase text-muted-foreground block">
              Assignee
            </label>
            {!isAssignedToMe && (
              <button
                type="button"
                onClick={() => handleAssign(currentUserId)}
                className="text-[10px] font-mono text-teal-400 hover:underline flex items-center gap-0.5"
              >
                <UserCheckIcon className="w-3 h-3" />
                Assign to me
              </button>
            )}
          </div>
          <Select
            value={ticket.assigneeId ?? 'unassigned'}
            onValueChange={(v: string | null) => handleAssign(!v || v === 'unassigned' ? undefined : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">
                <span className="text-muted-foreground">Unassigned</span>
              </SelectItem>
              {members.map(m => (
                <SelectItem key={m.userId || m.email} value={m.userId || m.email}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">({m.email})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Ticket Metadata Bar (Reporter & Assignee chips) */}
      <div className="flex items-center gap-4 mb-6 text-xs text-muted-foreground bg-muted/30 p-2.5 border border-border/50 font-mono">
        <div className="flex items-center gap-1.5">
          <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Reporter:</span>
          <span className="text-foreground font-semibold">
            {reporterMember ? `${reporterMember.name} (${reporterMember.email})` : ticket.reporterId}
          </span>
        </div>
        <span className="text-muted-foreground/40">|</span>
        <div className="flex items-center gap-1.5">
          <UserCheckIcon className="w-3.5 h-3.5 text-teal-400" />
          <span>Assignee:</span>
          <span className="text-foreground font-semibold">
            {assignedMember ? `${assignedMember.name}` : ticket.assigneeId ? ticket.assigneeId : 'Unassigned'}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <label className="text-xs font-medium uppercase text-muted-foreground mb-1 block">
          Description
        </label>
        <Textarea
          key={`desc-${ticket._id}-${ticket.description ?? ''}`}
          defaultValue={ticket.description ?? ''}
          placeholder="Add a detailed description…"
          onBlur={e => {
            const val = e.target.value.trim()
            if (val !== (ticket.description ?? '')) {
              update({ id: ticket._id, description: val || undefined })
            }
          }}
          rows={6}
          className="resize-y"
        />
      </div>

      {/* Attachments Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            Image Attachments ({(ticket.attachments ?? []).length})
          </label>
          <div>
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
              className="h-7 text-xs gap-1.5"
            >
              <UploadIcon className="w-3 h-3" />
              {uploading ? 'Uploading…' : 'Add Image'}
            </Button>
          </div>
        </div>

        {(ticket.attachments ?? []).length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ticket.attachments!.map(storageId => (
              <AttachmentImageItem
                key={storageId}
                storageId={storageId}
                onRemove={() => removeAttachment(storageId)}
              />
            ))}
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed rounded-none p-6 text-center text-xs text-muted-foreground/60 cursor-pointer hover:border-teal-500/50 hover:text-muted-foreground transition-colors"
          >
            Click or drag an image here to attach to this ticket.
          </div>
        )}
      </div>

      {/* Comment Thread */}
      <CommentThread ticketId={ticket._id} />

      <div className="text-xs text-muted-foreground/70 font-mono border-t pt-4 mt-8">
        Created {formatDistanceToNow(new Date(ticket.createdAt))} ago · Updated{' '}
        {formatDistanceToNow(new Date(ticket.updatedAt))} ago
      </div>
    </div>
  )
}


function AttachmentImageItem({
  storageId,
  onRemove,
}: {
  storageId: string
  onRemove: () => void
}) {
  const imageUrl = useQuery(api.tickets.getAttachmentUrl, { storageId })

  if (!imageUrl) {
    return <div className="h-24 bg-muted animate-pulse border" />
  }

  return (
    <div className="relative group border bg-card overflow-hidden">
      <img
        src={imageUrl}
        alt="Attachment"
        className="w-full h-28 object-cover transition-transform group-hover:scale-105"
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 p-1 bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        title="Remove attachment"
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
