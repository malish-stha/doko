import { UserInit } from '@/components/UserInit'
import { UserNav } from '@/components/UserNav'
import { NavTabs } from '@/components/NavTabs'
import { TeamGuard } from '@/components/TeamGuard'
import Link from 'next/link'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-teal-500/30 selection:text-teal-200">
      <UserInit />
      <header className="border-b border-border/80 bg-card/80 backdrop-blur-md px-6 py-2.5 flex items-center justify-between shrink-0 select-none sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-8">
          <Link href="/home" className="font-bold text-sm tracking-tight flex items-center gap-2 group active:scale-[0.98] transition-transform duration-150">
            <span className="w-5 h-5 bg-teal-500 text-black flex items-center justify-center font-mono text-xs font-bold rounded-none group-hover:bg-teal-400 transition-colors shadow-xs">
              D
            </span>
            <span className="font-semibold tracking-tight text-foreground font-sans">Doko</span>
          </Link>

          <NavTabs />
        </div>

        <UserNav />
      </header>

      <TeamGuard>
        <div className="flex-1 min-h-0">{children}</div>
      </TeamGuard>
    </div>
  )
}
