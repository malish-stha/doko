'use client'

import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import { SparklesIcon, CpuIcon, RefreshCwIcon, Loader2Icon } from 'lucide-react'
import { toast } from '@/components/ui/toast'

export function BriefCard({ brief }: { brief: Doc<'briefs'> }) {
  const [generating, setGenerating] = useState(false)
  const generateNow = useAction(api.briefActions.generateNow)

  const handleRegenerate = async () => {
    if (generating) return
    setGenerating(true)
    try {
      const res = await generateNow()
      if (res && !res.success && res.error) {
        toast.error('Cannot regenerate brief', res.error)
        return
      }
      toast.success('Morning Brief regenerated', 'Brief has been updated with the latest team activity.')
    } catch (err: any) {
      console.error('Failed to regenerate brief:', err)
      toast.error('Failed to regenerate brief', err?.message ?? 'Could not regenerate Morning Brief.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <article className="p-8 sm:p-10 rounded-none bg-card border border-teal-500/30 dark:border-teal-500/25 shadow-2xl relative overflow-hidden group backdrop-blur-md">
      {/* Ambient Teal Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 blur-3xl pointer-events-none rounded-full group-hover:bg-teal-500/15 transition-all duration-500 ease-out" />

      <div className="flex items-center justify-between mb-6 border-b border-border/60 pb-4 flex-wrap gap-2">
        <div className="text-xs uppercase tracking-widest text-teal-600 dark:text-teal-400 font-mono font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400 animate-pulse" />
          <SparklesIcon className="w-3.5 h-3.5" />
          Morning Brief · <span className="tabular-nums">{brief.forDate}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1 bg-muted px-2 py-0.5 border border-border">
            <CpuIcon className="w-3 h-3 text-teal-600 dark:text-teal-400" />
            {brief.providerUsed} AI
          </span>

          <button
            type="button"
            onClick={handleRegenerate}
            disabled={generating}
            className="text-[10px] font-mono uppercase tracking-wider text-teal-400 hover:text-teal-300 flex items-center gap-1.5 px-2 py-0.5 bg-teal-500/10 border border-teal-500/30 hover:bg-teal-500/20 active:scale-[0.97] transition-all duration-150 ease-out disabled:opacity-50 cursor-pointer"
            title="Regenerate Morning Brief"
          >
            {generating ? (
              <Loader2Icon className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCwIcon className="w-3 h-3" />
            )}
            Regenerate
          </button>
        </div>
      </div>

      <p className="text-xl sm:text-2xl font-normal leading-relaxed text-foreground tracking-tight whitespace-pre-wrap font-sans font-light">
        {brief.body}
      </p>
    </article>
  )
}
