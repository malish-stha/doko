'use client'

import { useQuery, useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HashIcon, PlusIcon, Hash, MessageSquarePlusIcon, UserIcon } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'
import { UserAvatar } from '@/components/UserAvatar'

export function ChannelSidebar() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const rawChannels = useQuery(api.channels.byTeam, userEmail ? { userEmail } : 'skip')
  const rawDms = useQuery(api.channels.myDMs, userEmail ? { userEmail } : 'skip')
  const channels = rawChannels ?? []
  const dms = rawDms ?? []
  const teammates = useQuery(api.teamMembers.listForTeam, userEmail ? { userEmail } : 'skip') ?? []
  const openDM = useMutation(api.channels.openDM)
  const createChannel = useMutation(api.channels.create)

  const params = useParams()
  const router = useRouter()

  const [creatingChannel, setCreatingChannel] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [pickDMOpen, setPickDMOpen] = useState(false)
  const [dmError, setDmError] = useState<string | null>(null)

  const handleCreateChannel = async () => {
    if (!channelName.trim()) return
    try {
      const channelId = await createChannel({ name: channelName, userEmail })
      toast.success('Channel created', `#${channelName.trim()} created successfully.`)
      setChannelName('')
      setCreatingChannel(false)
      router.push(`/chat/${channelId}`)
    } catch (err: any) {
      console.error('Failed to create channel:', err)
      toast.error('Failed to create channel', err?.message ?? 'Could not create channel.')
    }
  }

  const handleStartDM = async (otherUserId: string) => {
    setDmError(null)
    try {
      const id = await openDM({ otherUserId, userEmail })
      setPickDMOpen(false)
      router.push(`/chat/${id}`)
    } catch (err: any) {
      const msg = parseConvexError(err)
      setDmError(msg)
      toast.error('Failed to start conversation', msg)
    }
  }

  return (
    <aside className="w-56 border-r border-border bg-card flex flex-col shrink-0 select-none">
      <ScrollArea className="flex-1 p-2">
        {/* CHANNELS SECTION */}
        <div className="flex items-center justify-between px-2.5 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-teal-400" />
            Channels
          </div>
          {!creatingChannel && (
            <button
              type="button"
              onClick={() => setCreatingChannel(true)}
              className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
              title="Create channel"
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-0.5 mb-4">
          {rawChannels === undefined ? (
            <div className="space-y-1.5 px-2.5 py-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : (
            channels.map(c => {
              const active = params.channelId === c._id
              return (
                <Link
                  key={c._id}
                  href={`/chat/${c._id}`}
                  className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-teal-500/15 text-teal-400 font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <HashIcon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{c.name}</span>
                </Link>
              )
            })
          )}

          {creatingChannel && (
            <div className="p-2 border mt-2 bg-background">
              <label className="text-[10px] font-medium text-muted-foreground uppercase mb-1 block">
                New Channel
              </label>
              <Input
                autoFocus
                placeholder="channel-name"
                value={channelName}
                onChange={e => setChannelName(e.target.value)}
                className="h-7 text-xs"
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreateChannel()
                  }
                  if (e.key === 'Escape') {
                    setChannelName('')
                    setCreatingChannel(false)
                  }
                }}
              />
              <div className="flex justify-end gap-1 mt-2">
                <button
                  type="button"
                  onClick={() => setCreatingChannel(false)}
                  className="text-[11px] px-2 py-0.5 text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateChannel}
                  disabled={!channelName.trim()}
                  className="text-[11px] px-2 py-0.5 bg-teal-500 text-white disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {rawChannels !== undefined && channels.length === 0 && !creatingChannel && (
            <div className="px-2.5 py-1 text-xs text-muted-foreground/60 italic">
              No public channels yet.
            </div>
          )}
        </div>

        {/* DIRECT MESSAGES SECTION */}
        <div className="flex items-center justify-between px-2.5 py-2 border-t border-border/50">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <UserIcon className="w-3.5 h-3.5 text-teal-400" />
            Direct Messages
          </div>
        </div>

        <div className="space-y-0.5 mb-3">
          {rawDms === undefined ? (
            <div className="space-y-1.5 px-2.5 py-1">
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            dms.map(dm => {
              const active = params.channelId === dm._id
              const initial = (dm.name || 'D')[0].toUpperCase()
              return (
                <Link
                  key={dm._id}
                  href={`/chat/${dm._id}`}
                  className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-teal-500/15 text-teal-400 font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <div className="w-4 h-4 rounded-none bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-[9px] font-mono font-bold text-teal-300 shrink-0">
                    {initial}
                  </div>
                  <span className="truncate">{dm.name}</span>
                </Link>
              )
            })
          )}

          {rawDms !== undefined && dms.length === 0 && (
            <div className="px-2.5 py-1 text-xs text-muted-foreground/60 italic">
              No DMs yet.
            </div>
          )}
        </div>

        {/* Start DM Button & Dialog */}
        <div className="p-1">
          <Dialog open={pickDMOpen} onOpenChange={setPickDMOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs text-muted-foreground hover:text-teal-400 gap-1.5 h-8 px-2 font-mono uppercase"
                >
                  <MessageSquarePlusIcon className="w-3.5 h-3.5" />
                  + New DM
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm font-mono uppercase tracking-wider text-teal-400">
                  Start a direct message
                </DialogTitle>
              </DialogHeader>

              {dmError && (
                <div className="p-2 text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20">
                  {dmError}
                </div>
              )}

              <div className="space-y-1 max-h-72 overflow-y-auto divide-y divide-border/40">
                {teammates.length > 0 ? (
                  teammates.map(m => (
                    <button
                      key={m._id}
                      type="button"
                      onClick={() => handleStartDM(m.userId)}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-teal-500/10 text-left transition-colors cursor-pointer group"
                    >
                      <UserAvatar
                        user={{
                          email: m.email,
                          userId: m.userId,
                        }}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-foreground group-hover:text-teal-300 truncate">
                          {m.email}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono uppercase">
                          {m.role}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground italic">
                    No teammates found in this workspace.
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </ScrollArea>
    </aside>
  )
}
