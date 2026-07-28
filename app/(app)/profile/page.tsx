import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { UserProfileView } from '@/components/profile/UserProfileView'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/sign-in')

  const resolvedSearchParams = await searchParams
  const userId = resolvedSearchParams?.userId

  return <UserProfileView targetUserId={userId} />
}
