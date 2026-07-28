'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { UserIcon, LogOutIcon } from 'lucide-react'
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
      {/* User Profile Avatar & Dropdown Menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="User profile menu"
          className="rounded-none cursor-pointer overflow-hidden shadow-xs hover:ring-1 hover:ring-teal-400 active:scale-[0.95] transition-all duration-150 ease-out"
          title={user?.email ?? 'User Profile'}
        >
          <UserAvatar user={avatarUser} size="md" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-64 p-4 rounded-none bg-background border border-border shadow-2xl z-50 space-y-3 font-sans backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <UserAvatar user={avatarUser} size="lg" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground truncate">{user?.name ?? 'Doko User'}</div>
                <div className="text-[11px] font-mono text-muted-foreground truncate">{user?.email}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-mono font-semibold uppercase tracking-wider text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 transition-all text-center justify-center cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                View & Edit Profile
              </Link>

              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/sign-in' })}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono font-semibold uppercase tracking-wider text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all text-center justify-center cursor-pointer"
              >
                <LogOutIcon className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
