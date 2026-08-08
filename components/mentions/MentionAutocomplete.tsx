'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserAvatar } from '@/components/UserAvatar'

export type TeammateOption = {
  userId: string
  name: string
  email: string
  avatarUrl?: string
}

export function MentionAutocomplete({
  userEmail,
  filterQuery,
  onSelect,
}: {
  userEmail?: string
  filterQuery: string
  onSelect: (teammate: TeammateOption) => void
}) {
  const members = useQuery(api.tickets.listAssignableMembers, userEmail ? { userEmail } : {}) ?? []

  const needle = filterQuery.toLowerCase()
  const filtered = members.filter(
    m =>
      m.name.toLowerCase().includes(needle) ||
      m.email.toLowerCase().includes(needle) ||
      m.userId.toLowerCase().includes(needle),
  )

  if (filtered.length === 0) return null

  return (
    <div className="absolute z-50 mt-1 max-h-48 w-64 overflow-y-auto rounded-none border border-border bg-popover p-1 shadow-md">
      <div className="px-2 py-1 text-[10px] uppercase font-mono text-muted-foreground">
        Mention Teammate
      </div>
      {filtered.map(m => (
        <button
          key={m.userId}
          type="button"
          onMouseDown={e => {
            e.preventDefault()
            onSelect(m)
          }}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-popover-foreground hover:bg-muted/60 transition-colors text-left"
        >
          <UserAvatar user={{ name: m.name, email: m.email, userId: m.userId }} seed={m.email || m.userId} className="w-5 h-5" />

          <div className="truncate flex-1">
            <span className="font-medium">{m.name}</span>
            <span className="text-muted-foreground ml-1 font-mono text-[10px]">({m.email})</span>
          </div>
        </button>
      ))}
    </div>
  )
}
