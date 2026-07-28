'use client'

import { useSession } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'
import { ShieldIcon } from 'lucide-react'
import { SignOutButton } from './SignOutButton'

export function UserNav() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
  const initial = (user?.name ?? user?.email ?? 'U').slice(0, 1).toUpperCase()

  return (
    <div className="flex items-center gap-3">
      <SignOutButton />

      {/* User Details Icon & Dropdown Menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="User details menu"
          className="w-8 h-8 rounded-none bg-teal-500/20 text-teal-300 font-mono flex items-center justify-center text-xs font-semibold uppercase border border-teal-500/40 hover:bg-teal-500/30 hover:border-teal-400 active:scale-[0.95] transition-all duration-150 ease-out cursor-pointer overflow-hidden shadow-xs"
          title={user?.email ?? 'User Details'}
        >
          {user?.image ? (
            <img src={user.image} alt={user.name ?? 'Avatar'} className="w-full h-full object-cover" />
          ) : (
            <span>{initial}</span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-64 p-4 rounded-none bg-slate-900 border border-teal-500/30 shadow-2xl z-50 space-y-3 font-sans backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <div className="w-10 h-10 rounded-none bg-teal-500/20 text-teal-300 font-mono flex items-center justify-center text-sm font-semibold uppercase border border-teal-500/40 overflow-hidden shrink-0">
                {user?.image ? (
                  <img src={user.image} alt={user.name ?? 'Avatar'} className="w-full h-full object-cover" />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground truncate">{user?.name ?? 'Doko User'}</div>
                <div className="text-[11px] font-mono text-muted-foreground truncate">{user?.email}</div>
              </div>
            </div>

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
