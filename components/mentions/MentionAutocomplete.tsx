'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserAvatar } from '@/components/UserAvatar'

export type TeammateOption = {
  userId: string
  name: string
  email: string
  avatarUrl?: string
}

/**
 * Teammate picker shown while typing "@". Keyboard: ArrowUp/ArrowDown move,
 * Enter/Tab select, Escape closes. Listens on the document (capture) so the
 * owning textarea keeps focus and never sees the handled keys.
 */
export function MentionAutocomplete({
  filterQuery,
  onSelect,
  onClose,
}: {
  filterQuery: string
  onSelect: (teammate: TeammateOption) => void
  onClose?: () => void
}) {
  const members = useQuery(api.tickets.listAssignableMembers, {})
  const listId = useId()
  const [activeIndex, setActiveIndex] = useState(0)

  const filtered = useMemo(() => {
    const needle = filterQuery.toLowerCase()
    return (members ?? [])
      .filter(
        m =>
          (m.name && m.name.toLowerCase().includes(needle)) ||
          (m.email && m.email.toLowerCase().includes(needle)) ||
          (m.userId && m.userId.toLowerCase().includes(needle)),
      )
      .slice(0, 8)
  }, [members, filterQuery])

  // Keep the highlight in range when the query narrows the list (derived, not synced).
  const safeIndex = Math.min(activeIndex, Math.max(0, filtered.length - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (filtered.length === 0) return
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          setActiveIndex(i => (i + 1) % filtered.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          setActiveIndex(i => (i - 1 + filtered.length) % filtered.length)
          break
        case 'Enter':
        case 'Tab': {
          e.preventDefault()
          e.stopPropagation()
          const pick = filtered[safeIndex] ?? filtered[0]
          if (pick) onSelect(pick)
          break
        }
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          onClose?.()
          break
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [filtered, safeIndex, onSelect, onClose])

  if (filtered.length === 0) return null

  return (
    <div
      role="listbox"
      id={listId}
      aria-label="Mention a teammate"
      // Sits below the text area so it never covers what is being typed.
      className="absolute z-50 left-0 top-full mt-1 max-h-56 w-72 overflow-y-auto rounded border border-border bg-popover p-1 shadow-lg animate-in fade-in duration-150"
    >
      <div className="px-2 py-1 text-[10px] uppercase font-mono text-muted-foreground border-b border-border/40 mb-1">
        Mention teammate · ↑↓ then Enter
      </div>
      {filtered.map((m, index) => {
        const active = index === safeIndex
        return (
          <button
            key={m.userId || m.email}
            type="button"
            role="option"
            aria-selected={active}
            tabIndex={-1}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseDown={e => {
              e.preventDefault()
              onSelect(m)
            }}
            className={`flex w-full items-center gap-2 px-2 py-1.5 text-xs text-popover-foreground transition-colors text-left rounded cursor-pointer ${
              active ? 'bg-teal-500/15' : 'hover:bg-muted/60'
            }`}
          >
            <UserAvatar user={{ name: m.name, email: m.email, userId: m.userId }} seed={m.email || m.userId} className="w-5 h-5" />
            <div className="truncate flex-1">
              <span className="font-medium text-foreground">{m.name}</span>
              <span className="text-muted-foreground ml-1 font-mono text-[10px]">
                ({m.email ? m.email.split('@')[0] : m.userId})
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
