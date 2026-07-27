import { BriefContainer } from '@/components/brief/BriefContainer'
import { ProviderComparison } from '@/components/dev/ProviderComparison'
import Link from 'next/link'
import { LayoutGridIcon, MessageSquareIcon } from 'lucide-react'

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <BriefContainer />

      <div className="mt-12 pt-8 border-t border-border/50 flex items-center justify-between">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Quick Access
        </div>
        <div className="flex items-center gap-6 text-xs font-medium">
          <Link
            href="/board"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-teal-400 transition-colors"
          >
            <LayoutGridIcon className="w-3.5 h-3.5" />
            Board
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-teal-400 transition-colors"
          >
            <MessageSquareIcon className="w-3.5 h-3.5" />
            Chat
          </Link>
        </div>
      </div>

      <ProviderComparison />
    </main>
  )
}
