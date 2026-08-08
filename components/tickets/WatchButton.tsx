'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { EyeIcon, EyeOffIcon, UsersIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { UserAvatar } from '@/components/UserAvatar'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'

export function WatchButton({
  ticketId,
  userEmail,
}: {
  ticketId: Id<'tickets'>
  userEmail?: string
}) {
  const isWatching = useQuery(api.watchers.isWatching, { ticketId, userEmail }) ?? false
  const watchers = useQuery(api.watchers.forTicket, { ticketId, userEmail }) ?? []
  const subscribe = useMutation(api.watchers.subscribe)
  const unsubscribe = useMutation(api.watchers.unsubscribe)

  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      if (isWatching) {
        await unsubscribe({ ticketId, userEmail })
        toast.success('Unwatched ticket', 'You will no longer receive notifications for this ticket')
      } else {
        await subscribe({ ticketId, userEmail })
        toast.success('Watching ticket', 'You will receive notifications for activity on this ticket')
      }
    } catch (err: any) {
      toast.error('Failed to update watcher status', parseConvexError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={isWatching ? 'secondary' : 'outline'}
        size="sm"
        disabled={loading}
        onClick={handleToggle}
        className={`h-7 text-xs gap-1.5 border-border/60 ${
          isWatching ? 'bg-teal-500/15 text-teal-400 border-teal-500/30 hover:bg-teal-500/25' : ''
        }`}
      >
        {isWatching ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeOffIcon className="w-3.5 h-3.5" />}
        <span>{isWatching ? 'Watching' : 'Watch'}</span>
      </Button>

      <Popover>
        <PopoverTrigger className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground font-mono inline-flex items-center">
          <UsersIcon className="w-3.5 h-3.5 mr-1" />
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 bg-card border-border shadow-md" align="start">

          <div className="text-[11px] font-mono uppercase text-muted-foreground px-2 py-1 border-b border-border/40 mb-1">
            Watchers ({watchers.length})
          </div>
          {watchers.length === 0 ? (
            <div className="text-xs text-muted-foreground p-2">No watchers yet</div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {watchers.map(w => (
                <div key={w._id} className="flex items-center gap-2 p-1 text-xs">
                  <UserAvatar
                    name={w.userName}
                    avatarUrl={w.avatarUrl}
                    email={w.userEmail}
                    className="w-5 h-5"
                  />
                  <span className="truncate">{w.userName}</span>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
