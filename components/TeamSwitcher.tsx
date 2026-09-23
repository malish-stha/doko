'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckIcon, ChevronDownIcon, PlusIcon, UsersIcon } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'
import { cn } from '@/lib/utils'

/**
 * Lists every team the user belongs to and switches the active one.
 * Users can belong to many teams; `users.teamId` is only the active pointer.
 */
export function TeamSwitcher() {
  const teams = useQuery(api.teams.myTeams, {})
  const setActiveTeam = useMutation(api.teams.setActiveTeam)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<Id<'teams'> | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!teams || teams.length === 0) return null

  const active = teams.find(t => t.isActive) ?? teams[0]

  const switchTo = async (teamId: Id<'teams'>) => {
    if (teamId === active.teamId || switching) {
      setOpen(false)
      return
    }
    setSwitching(teamId)
    try {
      const result = await setActiveTeam({ teamId })
      toast.success('Switched team', `You are now working in ${result.teamName}.`)
      setOpen(false)
      router.replace('/home')
    } catch (err) {
      toast.error('Could not switch team', parseConvexError(err))
    } finally {
      setSwitching(null)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active team: ${active.name}. Switch team`}
        className="flex items-center gap-1.5 max-w-[180px] px-2.5 py-1.5 text-xs font-medium border border-border bg-background hover:bg-muted/60 transition-colors active:scale-[0.98] cursor-pointer"
      >
        <UsersIcon className="w-3.5 h-3.5 text-teal-500 shrink-0" aria-hidden />
        <span className="truncate">{active.name}</span>
        <ChevronDownIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Your teams"
          className="absolute right-0 mt-2 w-64 bg-background border border-border shadow-2xl z-50 font-sans"
        >
          <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
            Your teams
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {teams.map(team => {
              const isActive = team.teamId === active.teamId
              return (
                <li key={team.teamId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    disabled={switching !== null}
                    onClick={() => switchTo(team.teamId)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer disabled:cursor-wait',
                      isActive ? 'bg-teal-500/10 text-foreground' : 'hover:bg-muted/60 text-foreground',
                    )}
                  >
                    <span className="w-3.5 shrink-0">
                      {isActive && <CheckIcon className="w-3.5 h-3.5 text-teal-500" aria-hidden />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-medium">{team.name}</span>
                      <span className="block text-[10px] font-mono uppercase text-muted-foreground">{team.role}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-border p-1">
            <Link
              href="/onboarding"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-teal-500 hover:bg-teal-500/10 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" aria-hidden />
              New team or accept an invite
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
