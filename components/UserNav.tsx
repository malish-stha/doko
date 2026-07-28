'use client'

import { useSession } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { ShieldIcon, UserIcon } from 'lucide-react'
import { SignOutButton } from './SignOutButton'
import { UserAvatar } from './UserAvatar'

export function UserNav() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const me = useQuery(
    api.users.me,
    session?.user?.email ? { email: session.user.email } : 'skip'
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const user = session?.user
  const avatarUser = {
    avatarUrl: me?.avatarUrl,
    name: user?.name,
    email: user?.email,
  }

  return (
    <div className="flex items-center gap-3">
      <SignOutButton />

      {/* User Details Icon & Dropdown Menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="User details menu"
          className="rounded-none cursor-pointer overflow-hidden shadow-xs hover:ring-1 hover:ring-teal-400 active:scale-[0.95] transition-all duration-150 ease-out"
          title={user?.email ?? 'User Details'}
        >
          <UserAvatar user={avatarUser} size="md" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-64 p-4 rounded-none bg-slate-900 border border-teal-500/30 shadow-2xl z-50 space-y-3 font-sans backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <UserAvatar user={avatarUser} size="lg" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground truncate">{user?.name ?? 'Doko User'}</div>
                <div className="text-[11px] font-mono text-muted-foreground truncate">{user?.email}</div>
              </div>
            </div>

            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-mono font-semibold uppercase tracking-wider text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 transition-all text-center justify-center"
            >
              <UserIcon className="w-3.5 h-3.5" />
              View & Edit Profile
            </Link>

            <div className="text-[10px] font-mono uppercase tracking-wider text-teal-400/80 flex items-center gap-1.5 pt-1">
              <ShieldIcon className="w-3 h-3 text-teal-400" />
              Signed in via Google OAuth
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
