import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { TeamSettings } from '@/components/settings/TeamSettings'

export default async function TeamSettingsPage() {
  const session = await auth()
  if (!session) redirect('/sign-in')
  return <TeamSettings />
}
