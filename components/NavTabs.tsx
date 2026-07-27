'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SparklesIcon, LayoutGridIcon, MessageSquareIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NavTabs() {
  const pathname = usePathname()

  const tabs = [
    { href: '/', label: 'Brief', icon: SparklesIcon, exact: true },
    { href: '/board', label: 'Board', icon: LayoutGridIcon },
    { href: '/chat', label: 'Chat', icon: MessageSquareIcon },
  ]

  return (
    <nav className="flex items-center gap-1 text-xs font-medium">
      {tabs.map(tab => {
        const active = tab.exact
          ? pathname === '/'
          : pathname.startsWith(tab.href)
        const Icon = tab.icon

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-3 py-1.5 rounded-none text-xs font-medium transition-all duration-150 ease-out flex items-center gap-1.5 active:scale-[0.98]',
              active
                ? 'bg-teal-500/15 text-teal-400 font-semibold border-b-2 border-teal-400'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <Icon
              className={cn(
                'w-3.5 h-3.5 transition-colors',
                active ? 'text-teal-400' : 'text-muted-foreground/70',
              )}
            />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
