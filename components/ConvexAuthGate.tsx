'use client'

import { ReactNode } from 'react'
import { Authenticated, AuthLoading, Unauthenticated } from 'convex/react'
import { Loader2Icon, ShieldAlertIcon } from 'lucide-react'
import Link from 'next/link'

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
      <div className="flex flex-col items-center gap-3 text-center max-w-sm">{children}</div>
    </div>
  )
}

/**
 * Renders children only once Convex has accepted the caller's token.
 * While the token is being fetched a spinner is shown; if the session exists
 * but Convex never authenticates (misconfigured keys, issuer mismatch) the
 * user gets an explicit message instead of a wall of query errors.
 */
export function ConvexAuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <Centered>
          <Loader2Icon className="w-5 h-5 animate-spin text-teal-500" aria-hidden />
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Connecting to your workspace
          </p>
        </Centered>
      </AuthLoading>
      <Unauthenticated>
        <Centered>
          <ShieldAlertIcon className="w-6 h-6 text-rose-400" aria-hidden />
          <h1 className="text-base font-semibold">We couldn&apos;t verify your session</h1>
          <p className="text-sm text-muted-foreground">
            Your sign-in was not accepted by the workspace backend. Try signing in again; if this
            keeps happening the deployment&apos;s authentication keys are misconfigured.
          </p>
          <Link
            href="/sign-in"
            className="mt-2 text-xs font-mono uppercase tracking-wider text-teal-400 hover:text-teal-300"
          >
            Back to sign in
          </Link>
        </Centered>
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </>
  )
}
