'use client'

import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SparklesIcon } from 'lucide-react'

/**
 * Development-only A/B view of the caller's own brief through both providers.
 * The action refuses unless the deployment sets LLM_ALLOW_PROVIDER_COMPARE=1,
 * runs under the caller's identity, and is rate limited like everything else.
 */
export function ProviderComparison() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [anthropicText, setAnthropicText] = useState('')
  const [googleText, setGoogleText] = useState('')

  const compareProviders = useAction(api.briefActions.compareProviders)

  const handleCompare = async () => {
    setOpen(true)
    setLoading(true)
    setAnthropicText('')
    setGoogleText('')

    const describe = (res: Awaited<ReturnType<typeof compareProviders>>) =>
      res.success ? `${res.body}\n\n— ${res.provider}/${res.model}` : `Error: ${res.error}`

    try {
      const [ant, goog] = await Promise.all([
        compareProviders({ provider: 'anthropic' }),
        compareProviders({ provider: 'google' }),
      ])
      setAnthropicText(describe(ant))
      setGoogleText(describe(goog))
    } catch (err) {
      console.error(err)
      setAnthropicText('Error generating from Anthropic')
      setGoogleText('Error generating from Google Gemini')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleCompare}
        className="fixed bottom-4 left-4 z-50 text-[10px] font-mono tracking-wider uppercase px-3.5 py-2 bg-slate-900 text-teal-400 border border-teal-500/40 hover:bg-slate-800 active:scale-[0.97] transition-all duration-150 ease-out flex items-center gap-1.5 shadow-xl cursor-pointer"
        title="Compare Claude Opus 5 vs Google Gemini outputs (dev only)"
      >
        <SparklesIcon className="w-3.5 h-3.5 text-teal-400" />
        Compare LLM Briefs
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm uppercase tracking-wider text-teal-600 dark:text-teal-400">
              LLM Provider Comparison (dev)
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="py-12 text-center text-xs font-mono text-muted-foreground animate-pulse">
              Generating briefs from Claude Opus 5 and Gemini 2.0 Flash…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="p-4 border border-border bg-muted/40 dark:bg-slate-950 space-y-2">
                <div className="text-xs font-mono font-semibold uppercase text-teal-600 dark:text-teal-400">
                  Anthropic (Claude Opus 5)
                </div>
                <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans font-light">
                  {anthropicText}
                </p>
              </div>
              <div className="p-4 border border-border bg-muted/40 dark:bg-slate-950 space-y-2">
                <div className="text-xs font-mono font-semibold uppercase text-teal-600 dark:text-teal-400">
                  Google (Gemini 2.0 Flash)
                </div>
                <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans font-light">
                  {googleText}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
