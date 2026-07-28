'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'

export function TicketDetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header / Breadcrumb */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-20 rounded-none" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-9 w-3/4" />
          
          <div className="flex items-center gap-4 py-2 border-y border-border/40">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
          </div>

          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>

          {/* Attachments Section */}
          <div className="space-y-3 pt-4">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Skeleton className="h-24 w-full rounded-none" />
              <Skeleton className="h-24 w-full rounded-none" />
            </div>
          </div>

          {/* Comments Section */}
          <div className="space-y-4 pt-6 border-t border-border/40">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-none" />
              <Skeleton className="h-20 w-full rounded-none" />
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6 border border-border/40 p-5 rounded-none bg-card/50">
          <Skeleton className="h-5 w-28" />
          <div className="space-y-4">
            <div>
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div>
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div>
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div>
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
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
import {
  ImageIcon,
  UploadIcon,
  XIcon,
  MessageSquareIcon,
  UserCheckIcon,
  AlertCircleIcon,
  UserIcon,
  Maximize2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  ArchiveIcon,
  DownloadIcon,
  PaperclipIcon,
  ExternalLinkIcon,
} from 'lucide-react'
import { CommentThread } from './CommentThread'
import { StartDMButton } from '@/components/chat/StartDMButton'
import { Dialog, DialogContent } from '@/components/ui/dialog'

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
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
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
    return <TicketDetailSkeleton />
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
    <div className="max-w-4xl mx-auto p-6">
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
      <div className="flex items-center gap-4 mb-6 text-xs text-muted-foreground bg-muted/30 p-2.5 border border-border/50 font-mono flex-wrap">
        <div className="flex items-center gap-1.5">
          <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Reporter:</span>
          <span className="text-foreground font-semibold">
            {reporterMember
              ? reporterMember.name
              : ticket.reporterId === 'anonymous' || ticket.reporterId === 'dev-user'
              ? (me?.name || session?.user?.name || 'Teammate')
              : ticket.reporterId}
          </span>
          {ticket.reporterId &&
            ticket.reporterId !== currentUserId &&
            ticket.reporterId !== 'anonymous' &&
            ticket.reporterId !== 'dev-user' && (
              <StartDMButton userId={reporterMember?.userId ?? ticket.reporterId} label="DM" size="xs" />
            )}
        </div>
        <span className="text-muted-foreground/40">|</span>
        <div className="flex items-center gap-1.5">
          <UserCheckIcon className="w-3.5 h-3.5 text-teal-400" />
          <span>Assignee:</span>
          <span className="text-foreground font-semibold">
            {assignedMember ? `${assignedMember.name}` : ticket.assigneeId ? ticket.assigneeId : 'Unassigned'}
          </span>
          {ticket.assigneeId && ticket.assigneeId !== currentUserId && (
            <StartDMButton userId={assignedMember?.userId ?? ticket.assigneeId} label="DM" size="xs" />
          )}
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

      {/* Attachments Section (Images + Documents) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1.5">
            <PaperclipIcon className="w-3.5 h-3.5 text-teal-400" />
            Attachments ({(ticket.attachments ?? []).length})
          </label>
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-7 text-xs gap-1.5 border-teal-500/30 text-teal-300 hover:text-white"
            >
              <UploadIcon className="w-3 h-3" />
              {uploading ? 'Uploading…' : 'Add Attachment'}
            </Button>
          </div>
        </div>

        {(ticket.attachments ?? []).length > 0 ? (
          <AttachmentGallery
            storageIds={ticket.attachments!}
            onRemove={removeAttachment}
          />
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed rounded-none p-8 text-center text-xs text-muted-foreground/60 cursor-pointer hover:border-teal-500/50 hover:text-muted-foreground transition-colors bg-card/40"
          >
            Click or drag files (images, PDF, DOCX, XLSX, etc.) here to attach to this ticket.
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

function formatBytes(bytes?: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileBadge(contentType?: string | null) {
  if (!contentType) return { label: 'FILE', Icon: FileTextIcon, color: 'text-slate-300 border-white/20 bg-slate-800/50' }
  if (contentType.includes('pdf')) return { label: 'PDF', Icon: FileTextIcon, color: 'text-red-400 border-red-500/30 bg-red-500/10' }
  if (contentType.includes('word') || contentType.includes('docx') || contentType.includes('msword')) {
    return { label: 'DOCX', Icon: FileTextIcon, color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' }
  }
  if (contentType.includes('sheet') || contentType.includes('excel') || contentType.includes('csv')) {
    return { label: 'XLSX', Icon: FileSpreadsheetIcon, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' }
  }
  if (contentType.includes('zip') || contentType.includes('compressed') || contentType.includes('archive')) {
    return { label: 'ZIP', Icon: ArchiveIcon, color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' }
  }
  return { label: 'FILE', Icon: FileTextIcon, color: 'text-teal-400 border-teal-500/30 bg-teal-500/10' }
}

function AttachmentGallery({
  storageIds,
  onRemove,
}: {
  storageIds: string[]
  onRemove: (storageId: string) => void
}) {
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null)

  return (
    <div className="space-y-4">
      {/* Attachment Cards Grid */}
      <div
        className={`grid ${
          storageIds.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
        } gap-4`}
      >
        {storageIds.map((storageId, idx) => (
          <AttachmentCard
            key={storageId}
            storageId={storageId}
            isSingle={storageIds.length === 1}
            onOpenLightbox={() => setActiveLightboxIndex(idx)}
            onRemove={() => onRemove(storageId)}
          />
        ))}
      </div>

      {activeLightboxIndex !== null && (
        <AttachmentLightboxModal
          storageIds={storageIds}
          initialIndex={activeLightboxIndex}
          onClose={() => setActiveLightboxIndex(null)}
        />
      )}
    </div>
  )
}

function AttachmentCard({
  storageId,
  isSingle,
  onOpenLightbox,
  onRemove,
}: {
  storageId: string
  isSingle: boolean
  onOpenLightbox: () => void
  onRemove: () => void
}) {
  const meta = useQuery(api.tickets.getAttachmentMetadata, { storageId })

  if (meta === undefined) {
    return <div className={`${isSingle ? 'h-72 sm:h-80' : 'h-48'} bg-muted animate-pulse border`} />
  }

  const isImage = meta?.contentType ? meta.contentType.startsWith('image/') : true

  if (!isImage && meta?.url) {
    const badge = getFileBadge(meta.contentType)
    const { Icon } = badge
    return (
      <div className="relative group border border-white/10 bg-slate-950/90 p-4 rounded-none flex items-center justify-between gap-3 hover:border-teal-500/60 transition-all shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`px-2 py-1 border font-mono text-[10px] font-bold flex items-center gap-1 shrink-0 ${badge.color}`}>
            <Icon className="w-3.5 h-3.5" />
            {badge.label}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-foreground truncate font-mono">
              Attachment ({storageId.slice(-8)})
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {formatBytes(meta.size) || 'Document'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={meta.url}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-teal-400 hover:text-white border border-teal-500/30 hover:bg-teal-500/10 transition-colors"
            title="Download / Open document"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            Open
          </a>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Remove attachment"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  const imageUrl = meta?.url

  return (
    <div className="relative group border border-white/10 bg-slate-950/90 overflow-hidden rounded-none hover:border-teal-500/60 transition-all shadow-xl">
      <div
        onClick={onOpenLightbox}
        className={`cursor-pointer overflow-hidden p-3 flex items-center justify-center bg-black/60 ${
          isSingle ? 'min-h-[22rem] sm:min-h-[28rem]' : 'min-h-[16rem]'
        }`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Attachment preview"
            className={`w-full ${
              isSingle ? 'h-80 sm:h-[30rem]' : 'h-60 sm:h-72'
            } object-contain transition-transform duration-200 group-hover:scale-[1.01]`}
          />
        ) : (
          <div className="text-xs font-mono text-muted-foreground">Loading image…</div>
        )}
      </div>

      {/* Hover hint */}
      <div
        onClick={onOpenLightbox}
        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none"
      >
        <span className="text-xs font-mono font-semibold text-white bg-slate-950/90 px-3 py-1.5 border border-teal-500/40 shadow-xl flex items-center gap-1.5">
          <Maximize2Icon className="w-3.5 h-3.5 text-teal-400" />
          Click to open carousel view
        </span>
      </div>

      {/* Delete / Remove button */}
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onRemove()
        }}
        className="absolute top-2 right-2 p-1.5 bg-slate-950/80 border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 hover:border-red-500 z-10"
        title="Remove attachment"
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function AttachmentLightboxModal({
  storageIds,
  initialIndex,
  onClose,
}: {
  storageIds: string[]
  initialIndex: number
  onClose: () => void
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const currentStorageId = storageIds[currentIndex]
  const meta = useQuery(api.tickets.getAttachmentMetadata, { storageId: currentStorageId })

  const handlePrev = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : storageIds.length - 1))
  }, [storageIds.length])

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => (prev < storageIds.length - 1 ? prev + 1 : 0))
  }, [storageIds.length])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePrev, handleNext, onClose])

  const imageUrl = meta?.url

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[96vw] sm:max-w-none w-[96vw] max-h-[96vh] h-[96vh] bg-black/95 border border-white/10 p-0 flex flex-col items-center justify-center shadow-2xl overflow-hidden focus:outline-none"
      >
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-900/80 border border-white/20 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors z-50 cursor-pointer"
          title="Close (Esc)"
        >
          <XIcon className="w-5 h-5" />
        </button>

        {/* Floating Counter Badge */}
        {storageIds.length > 1 && (
          <div className="absolute top-4 left-4 px-3.5 py-1.5 bg-slate-900/90 border border-white/20 text-xs font-mono font-semibold text-teal-400 z-50 shadow-lg">
            Image {currentIndex + 1} of {storageIds.length}
          </div>
        )}

        {/* Carousel Prev Button */}
        {storageIds.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-slate-900/90 border border-white/20 text-white hover:bg-teal-500 hover:text-black transition-all z-50 cursor-pointer shadow-2xl active:scale-95"
            title="Previous image (Left Arrow)"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
        )}

        {/* Image display */}
        <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-10 select-none">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Attachment ${currentIndex + 1}`}
              className="max-h-[90vh] max-w-[92vw] object-contain shadow-2xl transition-all"
            />
          ) : (
            <div className="text-xs font-mono text-muted-foreground animate-pulse">
              Loading image…
            </div>
          )}
        </div>

        {/* Carousel Next Button */}
        {storageIds.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-slate-900/90 border border-white/20 text-white hover:bg-teal-500 hover:text-black transition-all z-50 cursor-pointer shadow-2xl active:scale-95"
            title="Next image (Right Arrow)"
          >
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}
