'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { LinkIcon, PlusIcon, XIcon, SearchIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'

const LINK_TYPES = [
  { value: 'blocks', label: 'Blocks' },
  { value: 'blocked_by', label: 'Is blocked by' },
  { value: 'relates_to', label: 'Relates to' },
  { value: 'duplicates', label: 'Duplicates' },
  { value: 'duplicated_by', label: 'Is duplicated by' },
]

export function TicketLinks({
  ticketId,
  userEmail,
}: {
  ticketId: Id<'tickets'>
  userEmail?: string
}) {
  const linksData = useQuery(api.ticketLinks.forTicket, { ticketId, userEmail }) ?? []
  const createLink = useMutation(api.ticketLinks.create)
  const removeLink = useMutation(api.ticketLinks.remove)

  const [open, setOpen] = useState(false)
  const [linkType, setLinkType] = useState('blocks')
  const [searchQuery, setSearchQuery] = useState('')

  const searchResults =
    useQuery(
      api.tickets.search,
      open ? { q: searchQuery, excludeId: ticketId, userEmail } : 'skip',
    ) ?? []

  const handleCreate = async (targetId: Id<'tickets'>) => {
    try {
      await createLink({
        sourceId: ticketId,
        targetId,
        type: linkType,
        userEmail,
      })
      toast.success('Link created')
      setOpen(false)
      setSearchQuery('')
    } catch (err: any) {
      toast.error('Failed to create link', parseConvexError(err))
    }
  }

  const handleRemove = async (linkId: Id<'ticketLinks'>) => {
    try {
      await removeLink({ linkId, userEmail })
      toast.success('Link removed')
    } catch (err: any) {
      toast.error('Failed to remove link', parseConvexError(err))
    }
  }

  return (
    <div className="space-y-3 pt-4 border-t border-border/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <LinkIcon className="w-4 h-4 text-teal-400" />
          <span>Linked Tickets ({linksData.length})</span>
        </div>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className="h-7 text-xs font-medium px-2.5 py-1 border border-border/60 hover:bg-muted/60 flex items-center gap-1">
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Link Ticket</span>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3 bg-card border-border shadow-xl space-y-3" align="end">
            <div className="text-xs font-semibold">Link Ticket</div>
            
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase font-mono">Relationship</label>
              <Select value={linkType} onValueChange={val => setLinkType(val ?? 'blocks')}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase font-mono">Search Ticket</label>
              <div className="relative">
                <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Type title or key (e.g. BUG-1)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-8 text-xs pl-8 bg-background"
                />
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 pt-1 border-t border-border/40">
              {searchResults.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-2">
                  No matching tickets found
                </div>
              ) : (
                searchResults.map(t => (
                  <button
                    key={t._id}
                    type="button"
                    onClick={() => handleCreate(t._id)}
                    className="w-full text-left p-1.5 rounded-none hover:bg-muted/50 transition-colors text-xs flex items-center justify-between group"
                  >
                    <div className="truncate">
                      <span className="font-mono text-teal-400 mr-2">{t.key}</span>
                      <span>{t.title}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
                      Link
                    </span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {linksData.length > 0 && (
        <div className="space-y-1.5">
          {linksData.map(({ link, target }) => {
            if (!target) return null
            const typeObj = LINK_TYPES.find(t => t.value === link.type)
            const isBlocked = link.type === 'blocked_by' && target.status !== 'done'

            return (
              <div
                key={link._id}
                className="group flex items-center justify-between p-2 bg-muted/20 border border-border/40 rounded-none text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-muted-foreground font-medium">
                    {typeObj?.label ?? link.type}:
                  </span>
                  {isBlocked && (
                    <span title="Unresolved blocker" className="text-red-400">
                      🚫
                    </span>
                  )}
                  <Link
                    href={`/board?ticket=${target.key}`}
                    className="font-mono text-teal-400 hover:underline font-semibold"
                  >
                    {target.key}
                  </Link>
                  <span className="truncate text-foreground">{target.title}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(link._id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 p-1 transition-opacity"
                  title="Remove link"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
