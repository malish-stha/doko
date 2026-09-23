'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { MailWarningIcon, ShieldAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  kind: 'mismatch' | 'error'
  code: string
  message: string
  signedInAs: string
}

/**
 * Shown when an emailed invite link cannot be accepted. The most common case
 * is signing in with a different Google account than the one invited.
 */
export function InviteResult({ kind, message, signedInAs }: Props) {
  const Icon = kind === 'mismatch' ? MailWarningIcon : ShieldAlertIcon
  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
      <div className="w-full max-w-md border border-border bg-card p-8 space-y-5 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 flex items-center justify-center bg-amber-500/10 border border-amber-500/30">
            <Icon className="w-4 h-4 text-amber-500" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold tracking-tight">
            {kind === 'mismatch' ? 'This invite is for a different account' : 'Could not accept invite'}
          </h1>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>

        <p className="text-xs font-mono text-muted-foreground">
          Signed in as <span className="text-foreground">{signedInAs}</span>
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          {kind === 'mismatch' ? (
            <Button
              type="button"
              onClick={() =>
                signOut({
                  callbackUrl: `/sign-in?redirect=${encodeURIComponent(
                    typeof window === 'undefined' ? '/onboarding' : window.location.pathname + window.location.search,
                  )}`,
                })
              }
              className="bg-teal-500 hover:bg-teal-400 text-black text-xs font-mono uppercase tracking-wider"
            >
              Sign in with the invited account
            </Button>
          ) : (
            <Link
              href="/onboarding"
              className="inline-flex items-center px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black text-xs font-mono uppercase tracking-wider transition-colors"
            >
              Go to onboarding
            </Link>
          )}
          <Link
            href="/home"
            className="inline-flex items-center px-4 py-2 border border-border text-xs font-mono uppercase tracking-wider hover:bg-muted/60 transition-colors"
          >
            Open my workspace
          </Link>
        </div>
      </div>
    </main>
  )
}
