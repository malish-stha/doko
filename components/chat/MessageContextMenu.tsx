'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import { CreateTicketFromMessageDialog } from '@/components/tickets/CreateTicketFromMessageDialog'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'
import { PencilIcon, TicketIcon, Trash2Icon } from 'lucide-react'

type ChatMessage = Doc<'messages'> & { canEdit?: boolean; canDelete?: boolean }

export function MessageContextMenu({
  message,
  children,
}: {
  message: ChatMessage
  children: React.ReactNode
}) {
  const [ticketOpen, setTicketOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState(message.body)
  const [busy, setBusy] = useState(false)
  const edit = useMutation(api.messages.edit)
  const remove = useMutation(api.messages.remove)

  const saveEdit = async () => {
    if (!draft.trim() || busy) return
    setBusy(true)
    try {
      await edit({ messageId: message._id, body: draft })
      setEditOpen(false)
    } catch (err) {
      toast.error('Could not edit message', parseConvexError(err))
    } finally {
      setBusy(false)
    }
  }

  const deleteMessage = async () => {
    if (!confirm('Delete this message for everyone?')) return
    try {
      await remove({ messageId: message._id })
    } catch (err) {
      toast.error('Could not delete message', parseConvexError(err))
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={() => setTicketOpen(true)} className="gap-2 text-xs cursor-pointer">
            <TicketIcon className="w-3.5 h-3.5 text-teal-400" />
            Create ticket from message
          </ContextMenuItem>
          {message.canEdit && (
            <ContextMenuItem
              onClick={() => {
                setDraft(message.body)
                setEditOpen(true)
              }}
              className="gap-2 text-xs cursor-pointer"
            >
              <PencilIcon className="w-3.5 h-3.5 text-muted-foreground" />
              Edit message
            </ContextMenuItem>
          )}
          {message.canDelete && (
            <ContextMenuItem onClick={deleteMessage} className="gap-2 text-xs cursor-pointer text-red-400">
              <Trash2Icon className="w-3.5 h-3.5" />
              Delete message
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <CreateTicketFromMessageDialog open={ticketOpen} onOpenChange={setTicketOpen} message={message} />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono uppercase tracking-wider text-teal-400">
              Edit message
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                saveEdit()
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!draft.trim() || busy}
              onClick={saveEdit}
              className="bg-teal-500 hover:bg-teal-400 text-black text-xs"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
