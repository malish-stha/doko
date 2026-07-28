'use client'

import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { SparklesIcon, ArrowRightIcon, Loader2Icon } from 'lucide-react'
import { toast } from '@/components/ui/toast'

export function BriefEmptyState() {
  const [generating, setGenerating] = useState(false)
  const generateNow = useAction(api.briefActions.generateNow)

  const handleGenerate = async () => {
    if (generating) return
    setGenerating(true)
    try {
      await generateNow()
      toast.success('Morning Brief generated', 'Today\'s brief has been created from team activity.')
    } catch (err: any) {
      console.error('Failed to generate brief:', err)
      toast.error('Failed to generate brief', err?.message ?? 'Could not generate Morning Brief.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <article className="p-8 sm:p-10 rounded-none border border-dashed border-teal-500/30 bg-slate-900/40 backdrop-blur-sm flex flex-col items-start space-y-5 shadow-lg relative overflow-hidden group">
      <div className="text-xs uppercase tracking-widest text-teal-400 flex items-center gap-2 font-mono font-semibold">
        <span className="w-2 h-2 rounded-full bg-teal-400/80 animate-pulse" />
        <SparklesIcon className="w-4 h-4 text-teal-400" />
        Morning Brief
      </div>

      <p className="text-lg text-foreground/90 leading-relaxed max-w-xl font-sans">
        Your AI Morning Brief automatically generates every morning at 8:00 AM. Click below to generate today's Morning Brief immediately from team activity!
      </p>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider bg-teal-500 text-black px-5 py-2.5 hover:bg-teal-400 active:scale-[0.97] transition-all duration-150 ease-out disabled:opacity-50 cursor-pointer shadow-md"
        >
          {generating ? (
            <>
              <Loader2Icon className="w-4 h-4 animate-spin" />
              Generating Brief…
            </>
          ) : (
            <>
              <SparklesIcon className="w-4 h-4" />
              Generate Morning Brief Now
            </>
          )}
        </button>

        <Link
          href="/board"
          className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground active:scale-[0.98] transition-all duration-150 ease-out"
        >
          Go to Board <ArrowRightIcon className="w-3.5 h-3.5" />
        </Link>
      </div>
    </article>
  )
}
