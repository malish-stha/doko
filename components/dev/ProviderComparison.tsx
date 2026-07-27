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

export function ProviderComparison() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [anthropicText, setAnthropicText] = useState('')
  const [googleText, setGoogleText] = useState('')

  const generateForProvider = useAction(api.briefActions.generateForProvider)

  const handleCompare = async () => {
    setOpen(true)
    setLoading(true)
    setAnthropicText('')
    setGoogleText('')

    const date = new Date().toISOString().split('T')[0]
    try {
      const [ant, goog] = await Promise.all([
        generateForProvider({
          userId: 'dev-user',
          forDate: date,
          provider: 'anthropic',
        }),
        generateForProvider({
          userId: 'dev-user',
          forDate: date,
          provider: 'google',
        }),
      ])
      setAnthropicText(ant ?? 'No response')
      setGoogleText(goog ?? 'No response')
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
        className="fixed bottom-4 left-4 z-50 text-[10px] font-mono tracking-wider uppercase px-3 py-2 bg-slate-900 text-teal-400 border border-teal-500/40 hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xl cursor-pointer"
        title="Compare Anthropic Sonnet vs Google Gemini outputs"
      >
        <SparklesIcon className="w-3.5 h-3.5 text-teal-400" />
        Compare LLM Briefs
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>LLM Provider Comparison (A/B Test)</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
              Generating Briefs from Anthropic Sonnet & Google Gemini…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="p-4 border bg-slate-950 space-y-2">
                <div className="text-xs font-mono font-semibold uppercase text-teal-400">
                  Anthropic (Claude Sonnet)
                </div>
                <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                  {anthropicText}
                </p>
              </div>
              <div className="p-4 border bg-slate-950 space-y-2">
                <div className="text-xs font-mono font-semibold uppercase text-teal-400">
                  Google (Gemini Pro)
                </div>
                <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
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
