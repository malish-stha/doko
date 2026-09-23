'use client'

import type { Doc } from '@/convex/_generated/dataModel'
import { formatDistanceToNow } from 'date-fns'
import { HashIcon, LockIcon } from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'

/** Header for a channel. Receives the channel from ChatPane so it is fetched once. */
export function ChatHeader({ channel }: { channel: Doc<'channels'> | null | undefined }) {
  if (!channel) {
    return <div className="px-6 py-3.5 border-b border-border h-14 bg-card" />
  }

  const isDM = channel.kind === 'dm'
  const isPrivate = channel.kind === 'private'

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
            {isPrivate ? (
              <LockIcon className="w-4 h-4 text-amber-400" aria-label="Private channel" />
            ) : (
              <HashIcon className="w-4 h-4 text-teal-400" aria-hidden />
            )}
            <div>
              <h2 className="font-semibold text-sm tracking-tight text-foreground">
                #{channel.name}
              </h2>
              <p className="text-[10px] font-mono text-muted-foreground">
                {isPrivate
                  ? `Private · ${channel.memberIds.length} member${channel.memberIds.length !== 1 ? 's' : ''}`
                  : 'Public · open to the whole team'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
