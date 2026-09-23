'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'
import { EpicPill } from './EpicPill'
import { EpicChildrenTable } from './EpicChildrenTable'
import { EpicPicker } from './EpicPicker'
import { SubtaskChecklist } from './SubtaskChecklist'
import { TicketLinks } from './TicketLinks'
import { DescriptionEditor } from './DescriptionEditor'
import { WatchButton } from './WatchButton'
import { ActivityTimeline } from './ActivityTimeline'
import { AttachmentDropZone } from './AttachmentDropZone'


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
import { UserAvatar } from '@/components/UserAvatar'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { formatDistanceToNow } from 'date-fns'
import { XIcon, MessageSquareIcon, UserCheckIcon, AlertCircleIcon } from 'lucide-react'
import { CommentThread } from './CommentThread'
import { StartDMButton } from '@/components/chat/StartDMButton'

export function TicketDetailClient({ ticketKey }: { ticketKey: string }) {
  const { data: session } = useSession()

  const ticket = useQuery(api.tickets.getByKey, { key: ticketKey })
  const members = useQuery(api.tickets.listAssignableMembers, {}) ?? []

  // Fire-and-forget field saves still surface failures instead of unhandled rejections.
  const save = (p: Promise<unknown>) => {
    p.catch(err => toast.error('Could not save change', parseConvexError(err)))
  }

  const update = useMutation(api.tickets.update)
  const assignMutation = useMutation(api.tickets.assign)
  const updateStatus = useMutation(api.tickets.updateStatus)

  const [assignError, setAssignError] = useState<string | null>(null)

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
      })
      toast.success('Assignee updated')
    } catch (err) {
      const msg = parseConvexError(err)
      setAssignError(msg)
      toast.error('Failed to update assignee', err)
    }
  }

  const handleUpdateStatus = async (status: Doc<'tickets'>['status']) => {
    if (!ticket) return
    try {
      await updateStatus({ id: ticket._id, status })
      toast.success('Status updated', `Changed status to ${status.replace('_', ' ')}`)
    } catch (err) {
      toast.error('Failed to update status', parseConvexError(err))
    }
  }

  const handleUpdatePriority = async (priority: Doc<'tickets'>['priority']) => {
    if (!ticket) return
    try {
      await update({ id: ticket._id, priority })
      toast.success('Priority updated', `Priority set to ${priority}`)
    } catch (err) {
      toast.error('Failed to update priority', parseConvexError(err))
    }
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

      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground">{ticket.key}</span>
          <span className="text-[10px] px-1.5 py-0.5 border font-medium uppercase tracking-wider bg-muted text-muted-foreground">
            {ticket.type}
          </span>
          {ticket.epicId && <EpicPill epicId={ticket.epicId} />}
        </div>
        <WatchButton ticketId={ticket._id} />
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
            save(update({ id: ticket._id, title: val }))
          }
        }}
        className="text-2xl font-bold tracking-tight mb-6 border-0 focus-visible:ring-1 focus-visible:ring-teal-500/50 px-0 h-auto py-1"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
        <div>
          <label className="text-xs font-medium uppercase text-muted-foreground mb-1 block">
            Status
          </label>
          <Select
            value={ticket.status}
            onValueChange={v => v && handleUpdateStatus(v as Doc<'tickets'>['status'])}
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
            onValueChange={v => v && handleUpdatePriority(v as Doc<'tickets'>['priority'])}
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

      {ticket.type !== 'epic' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground mb-1 block">
              Parent Epic
            </label>
            <EpicPicker
              value={ticket.epicId}
              onChange={epicId => save(update({ id: ticket._id, epicId: (epicId as Id<'tickets'> | null | undefined) ?? null }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground mb-1 block">
              Story Points
            </label>
            <Input
              type="number"
              step="0.5"
              min={0}
              max={100}
              defaultValue={ticket.storyPoints != null ? ticket.storyPoints : ''}
              onBlur={e => {
                const val = parseFloat(e.target.value)
                if (Number.isFinite(val) && val >= 0) {
                  if (val !== ticket.storyPoints) {
                    save(update({ id: ticket._id, storyPoints: val }))
                  }
                } else if (e.target.value === '') {
                  save(update({ id: ticket._id, storyPoints: null }))
                }
              }}
              placeholder="Estimate (e.g. 3, 5, 8)..."
              className="text-xs font-mono"
            />
          </div>
        </div>
      )}

      {/* Ticket Metadata Bar (Reporter & Assignee chips) */}
      <div className="flex items-center gap-4 mb-6 text-xs text-muted-foreground bg-muted/30 p-2.5 border border-border/50 font-mono flex-wrap">
        <div className="flex items-center gap-1.5">
          <UserAvatar
            user={{
              name: reporterMember?.name,
              email: reporterMember?.email,
              userId: reporterMember?.userId || ticket.reporterId,
              avatarUrl: undefined,
            }}
            seed={reporterMember?.email || reporterMember?.userId || ticket.reporterId}
            size="xs"
          />
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
          <UserAvatar
            user={{
              name: assignedMember?.name,
              email: assignedMember?.email,
              userId: assignedMember?.userId || ticket.assigneeId,
              avatarUrl: undefined,
            }}
            seed={assignedMember?.email || assignedMember?.userId || ticket.assigneeId}
            size="xs"
          />
          <span>Assignee:</span>
          <span className="text-foreground font-semibold">
            {assignedMember ? `${assignedMember.name}` : ticket.assigneeId ? ticket.assigneeId : 'Unassigned'}
          </span>
          {ticket.assigneeId && ticket.assigneeId !== currentUserId && (
            <StartDMButton userId={assignedMember?.userId ?? ticket.assigneeId} label="DM" size="xs" />
          )}
        </div>
      </div>

      <div className="mb-6 space-y-1.5">
        <label className="text-xs font-mono uppercase font-semibold text-muted-foreground block">
          Description
        </label>
        <DescriptionEditor
          initialValue={ticket.description ?? ''}
          onSave={val => save(update({ id: ticket._id, description: val || null }))}
         
        />
      </div>

      <SubtaskChecklist ticketId={ticket._id} />

      <TicketLinks ticketId={ticket._id} />

      {ticket.type === 'epic' && (
        <div className="mb-8 pt-4 border-t border-border/40">
          <EpicChildrenTable epicId={ticket._id} />
        </div>
      )}

      <AttachmentDropZone ticketId={ticket._id} />

      {/* Comment Thread */}
      <CommentThread ticketId={ticket._id} />

      {/* Activity Timeline */}
      <ActivityTimeline ticketId={ticket._id} />


      <div className="text-xs text-muted-foreground/70 font-mono border-t pt-4 mt-8">
        Created {formatDistanceToNow(new Date(ticket.createdAt))} ago · Updated{' '}
        {formatDistanceToNow(new Date(ticket.updatedAt))} ago
      </div>
    </div>
  )
}
