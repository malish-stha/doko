import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  if (!token) redirect('/sign-in')

  const session = await auth()
  if (!session) {
    redirect(`/sign-in?redirect=${encodeURIComponent(`/invite/accept?token=${token}`)}`)
  }

  redirect('/onboarding')
}
