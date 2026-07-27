import type { Doc } from '@/convex/_generated/dataModel'
import { SparklesIcon, CpuIcon } from 'lucide-react'

export function BriefCard({ brief }: { brief: Doc<'briefs'> }) {
  return (
    <article className="p-8 sm:p-10 rounded-none bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950 border border-teal-500/25 shadow-2xl relative overflow-hidden group backdrop-blur-md">
      {/* Ambient Teal Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 blur-3xl pointer-events-none rounded-full group-hover:bg-teal-500/15 transition-all duration-500 ease-out" />

      <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
        <div className="text-xs uppercase tracking-widest text-teal-400 font-mono font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          <SparklesIcon className="w-3.5 h-3.5" />
          Morning Brief · <span className="tabular-nums">{brief.forDate}</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider flex items-center gap-1 bg-white/5 px-2 py-0.5 border border-white/10">
          <CpuIcon className="w-3 h-3 text-teal-400" />
          {brief.providerUsed} AI
        </span>
      </div>

      <p className="text-xl sm:text-2xl font-normal leading-relaxed text-foreground tracking-tight whitespace-pre-wrap font-sans font-light">
        {brief.body}
      </p>
    </article>
  )
}
