'use client'

import { useQuery } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { formatDistanceToNow } from 'date-fns'
import { HashIcon, UserIcon } from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'

export function ChatHeader({ channelId }: { channelId: Id<'channels'> }) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const channel = useQuery(api.channels.get, { channelId, userEmail })

  if (!channel) {
    return <div className="px-6 py-3.5 border-b border-border h-14 bg-card" />
  }

  const isDM = channel.kind === 'dm'

  return (
    <div className="px-6 py-3.5 border-b border-border flex items-center justify-between bg-card shrink-0">
      <div className="flex items-center gap-2.5">
        {isDM ? (
          <>
            <UserAvatar seed={channel.name} size="sm" className="shrink-0" />
            <div>
              <h2 className="font-semibold text-sm tracking-tight text-foreground flex items-center gap-2">
                {channel.name}
              </h2>
              <p className="text-[10px] font-mono text-muted-foreground">
                Direct message · started {formatDistanceToNow(new Date(channel.createdAt))} ago
              </p>
            </div>
          </>
        ) : (
          <>
            <HashIcon className="w-4 h-4 text-teal-400" />
            <div>
              <h2 className="font-semibold text-sm tracking-tight text-foreground">
                #{channel.name}
              </h2>
              <p className="text-[10px] font-mono text-muted-foreground">
                {channel.memberIds.length} member{channel.memberIds.length !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
