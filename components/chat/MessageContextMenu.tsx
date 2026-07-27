'use client'

import { useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { Doc } from '@/convex/_generated/dataModel'
import { CreateTicketFromMessageDialog } from '@/components/tickets/CreateTicketFromMessageDialog'
import { TicketIcon } from 'lucide-react'

export function MessageContextMenu({
  message,
  children,
}: {
  message: Doc<'messages'>
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem
            onClick={() => setOpen(true)}
            className="gap-2 text-xs cursor-pointer"
          >
            <TicketIcon className="w-3.5 h-3.5 text-teal-400" />
            Create ticket from message
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <CreateTicketFromMessageDialog
        open={open}
        onOpenChange={setOpen}
        message={message}
      />
    </>
  )
}
