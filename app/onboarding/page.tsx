import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { OnboardingClient } from '@/components/onboarding/OnboardingClient'
import { ConvexAuthGate } from '@/components/ConvexAuthGate'
import { UserInit } from '@/components/UserInit'

export default async function OnboardingPage() {
  const session = await auth()
  if (!session) redirect('/sign-in')
  return (
    <ConvexAuthGate>
      <UserInit />
      <OnboardingClient />
    </ConvexAuthGate>
  )
}
