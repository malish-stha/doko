'use client'

import { useQuery, useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { HashIcon, PlusIcon, Hash } from 'lucide-react'

export function ChannelSidebar() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const channels = useQuery(api.channels.byTeam, userEmail ? { userEmail } : 'skip') ?? []
  const params = useParams()
  const router = useRouter()

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const create = useMutation(api.channels.create)

  const handleCreate = async () => {
    if (!name.trim()) return
    try {
      const channelId = await create({ name, userEmail })
      setName('')
      setCreating(false)
      router.push(`/chat/${channelId}`)
    } catch (err) {
      console.error('Failed to create channel:', err)
    }
  }

  return (
    <aside className="w-56 border-r border-border bg-card flex flex-col shrink-0 select-none">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5 text-teal-400" />
          Channels
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
            title="Create channel"
          >
            <PlusIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="space-y-0.5">
          {channels.map(c => {
            const active = params.channelId === c._id
            return (
              <Link
                key={c._id}
                href={`/chat/${c._id}`}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-none text-xs font-medium transition-colors ${
                  active
                    ? 'bg-teal-500/15 text-teal-400 font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <HashIcon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                <span className="truncate">{c.name}</span>
              </Link>
            )
          })}
        </div>

        {creating && (
          <div className="p-2 border mt-2 bg-background">
            <label className="text-[10px] font-medium text-muted-foreground uppercase mb-1 block">
              New Channel
            </label>
            <Input
              autoFocus
              placeholder="channel-name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-7 text-xs"
              onKeyDown={async e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreate()
                }
                if (e.key === 'Escape') {
                  setName('')
                  setCreating(false)
                }
              }}
            />
            <div className="flex justify-end gap-1 mt-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="text-[11px] px-2 py-0.5 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!name.trim()}
                className="text-[11px] px-2 py-0.5 bg-teal-500 text-white disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {channels.length === 0 && !creating && (
          <div className="p-3 text-center text-xs text-muted-foreground/60 italic">
            No channels yet. Click + to create one.
          </div>
        )}
      </ScrollArea>
    </aside>
  )
}
