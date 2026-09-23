import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { fetchMutation } from 'convex/nextjs'
import { ConvexError } from 'convex/values'
import { api } from '@/convex/_generated/api'
import { mintConvexToken } from '@/lib/convexToken'
import { InviteResult } from '@/components/invite/InviteResult'

export const dynamic = 'force-dynamic'

function describeError(err: unknown): { code: string; message: string } {
  if (err instanceof ConvexError) {
    const data = err.data as { code?: string; message?: string } | string
    if (typeof data === 'string') return { code: 'ERROR', message: data }
    return { code: data.code ?? 'ERROR', message: data.message ?? 'Could not accept the invite.' }
  }
  const raw = err instanceof Error ? err.message : String(err)
  // Convex wraps thrown ConvexError data in the message for server callers.
  const match = raw.match(/"message":"([^"]+)"/)
  return { code: 'ERROR', message: match?.[1] ?? 'Could not accept the invite.' }
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  if (!token) redirect('/sign-in')

  const session = await auth()
  const email = session?.user?.email?.trim().toLowerCase()
  if (!session || !email) {
    redirect(`/sign-in?redirect=${encodeURIComponent(`/invite/accept?token=${token}`)}`)
  }

  let result: { teamId: string; teamName: string; alreadyMember: boolean }
  try {
    const convexToken = await mintConvexToken({
      email,
      name: session.user?.name,
      image: session.user?.image,
    })
    result = await fetchMutation(api.invites.acceptByToken, { token }, { token: convexToken })
  } catch (err) {
    const { code, message } = describeError(err)
    const mismatch = /signed in as/i.test(message)
    return (
      <InviteResult
        kind={mismatch ? 'mismatch' : 'error'}
        code={code}
        message={message}
        signedInAs={email}
      />
    )
  }

  redirect(`/home?joined=${encodeURIComponent(result.teamName)}`)
}
