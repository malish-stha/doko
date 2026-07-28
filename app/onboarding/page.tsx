import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { OnboardingClient } from '@/components/onboarding/OnboardingClient'

export default async function OnboardingPage() {
  const session = await auth()
  if (!session) redirect('/sign-in')
  return <OnboardingClient />
}
