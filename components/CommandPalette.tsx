'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useHotkey } from '@/lib/hotkeys'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from 'cmdk'
import {
  LayoutGridIcon,
  ListTodoIcon,
  FolderGit2Icon,
  InboxIcon,
  TableIcon,
  SettingsIcon,
  TicketIcon,
  UserIcon,
  MessageSquareIcon,
} from 'lucide-react'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [recentTickets, setRecentTickets] = useState<{ key: string; title: string }[]>([])
  const router = useRouter()

  useHotkey('mod+k', () => setOpen(true), {
    description: 'Open Command Palette',
    scope: 'Global Navigation',
  })

  useEffect(() => {
    try {
      const stored = localStorage.getItem('doko_recent_tickets')
      if (stored) {
        setRecentTickets(JSON.parse(stored).slice(0, 5))
      }
    } catch {
      // ignore
    }
  }, [open])

  const ticketResults = useQuery(api.tickets.search, query ? { q: query } : 'skip') ?? []
  const teamMembers = useQuery(api.teamMembers.listForTeam, {}) ?? []
  const channels = useQuery(api.channels.byTeam, {}) ?? []

  const filteredMembers = query
    ? teamMembers.filter((m: any) => (m.name ?? m.email).toLowerCase().includes(query.toLowerCase()))
    : []

  const filteredChannels = query
    ? channels.filter((c: any) => c.name.toLowerCase().includes(query.toLowerCase()))
    : []

  const handleSelect = (action: () => void) => {
    setOpen(false)
    setQuery('')
    action()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0 border border-border shadow-2xl rounded-lg overflow-hidden bg-card">
        <Command className="w-full flex flex-col max-h-[70vh]">
          <div className="flex items-center border-b border-border px-3 py-2">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Type a command or search tickets, members, channels..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-none py-1"
            />
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded">
              ESC
            </kbd>
          </div>

          <CommandList className="overflow-y-auto p-2 space-y-2 max-h-[60vh] text-sm">
            <CommandEmpty className="p-4 text-center text-xs text-muted-foreground">
              No matching commands or items found.
            </CommandEmpty>

            {!query && recentTickets.length > 0 && (
              <CommandGroup heading="Recent Tickets" className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1">
                {recentTickets.map(t => (
                  <CommandItem
                    key={t.key}
                    onSelect={() => handleSelect(() => router.push(`/tickets/${t.key}`))}
                    className="flex items-center gap-2 px-2.5 py-2 rounded text-foreground hover:bg-muted/50 cursor-pointer text-xs"
                  >
                    <TicketIcon className="w-4 h-4 text-teal-400 shrink-0" />
                    <span className="font-mono text-muted-foreground">{t.key}</span>
                    <span className="truncate">{t.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {ticketResults.length > 0 && (
              <CommandGroup heading="Tickets" className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1">
                {ticketResults.map((t: any) => (
                  <CommandItem
                    key={t._id}
                    onSelect={() => handleSelect(() => router.push(`/tickets/${t.key}`))}
                    className="flex items-center gap-2 px-2.5 py-2 rounded text-foreground hover:bg-muted/50 cursor-pointer text-xs"
                  >
                    <TicketIcon className="w-4 h-4 text-teal-400 shrink-0" />
                    <span className="font-mono text-muted-foreground">{t.key}</span>
                    <span className="truncate">{t.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredMembers.length > 0 && (
              <CommandGroup heading="Team Members" className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1">
                {filteredMembers.map((m: any) => (
                  <CommandItem
                    key={m.userId}
                    onSelect={() => handleSelect(() => router.push(`/chat?dm=${m.userId}`))}
                    className="flex items-center gap-2 px-2.5 py-2 rounded text-foreground hover:bg-muted/50 cursor-pointer text-xs"
                  >
                    <UserIcon className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="font-medium">{m.name ?? m.email}</span>
                    <span className="text-[11px] text-muted-foreground">Direct Message</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredChannels.length > 0 && (
              <CommandGroup heading="Channels" className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1">
                {filteredChannels.map((c: any) => (
                  <CommandItem
                    key={c._id}
                    onSelect={() => handleSelect(() => router.push(`/chat?channel=${c._id}`))}
                    className="flex items-center gap-2 px-2.5 py-2 rounded text-foreground hover:bg-muted/50 cursor-pointer text-xs"
                  >
                    <MessageSquareIcon className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>#{c.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator className="my-1 border-t border-border/40" />

            <CommandGroup heading="Navigation & Quick Actions" className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1">
              <CommandItem
                onSelect={() => handleSelect(() => router.push('/board'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded text-foreground hover:bg-muted/50 cursor-pointer text-xs"
              >
                <LayoutGridIcon className="w-4 h-4 text-teal-400" />
                <span>Go to Board</span>
              </CommandItem>

              <CommandItem
                onSelect={() => handleSelect(() => router.push('/tickets'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded text-foreground hover:bg-muted/50 cursor-pointer text-xs"
              >
                <TableIcon className="w-4 h-4 text-purple-400" />
                <span>Go to Tickets List View</span>
              </CommandItem>

              <CommandItem
                onSelect={() => handleSelect(() => router.push('/backlog'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded text-foreground hover:bg-muted/50 cursor-pointer text-xs"
              >
                <ListTodoIcon className="w-4 h-4 text-blue-400" />
                <span>Go to Backlog</span>
              </CommandItem>

              <CommandItem
                onSelect={() => handleSelect(() => router.push('/epics'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded text-foreground hover:bg-muted/50 cursor-pointer text-xs"
              >
                <FolderGit2Icon className="w-4 h-4 text-amber-400" />
                <span>Go to Epics</span>
              </CommandItem>

              <CommandItem
                onSelect={() => handleSelect(() => router.push('/inbox'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded text-foreground hover:bg-muted/50 cursor-pointer text-xs"
              >
                <InboxIcon className="w-4 h-4 text-red-400" />
                <span>Go to Inbox</span>
              </CommandItem>

              <CommandItem
                onSelect={() => handleSelect(() => router.push('/settings/board'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded text-foreground hover:bg-muted/50 cursor-pointer text-xs"
              >
                <SettingsIcon className="w-4 h-4 text-muted-foreground" />
                <span>Board Settings & WIP Limits</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
