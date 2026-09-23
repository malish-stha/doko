import { signIn } from '@/auth'
import { SignInClient } from '@/components/auth/SignInClient'
import { safeRedirectPath } from '@/lib/redirect'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect } = await searchParams
  const redirectTo = safeRedirectPath(redirect)

  return (
    <SignInClient
      redirectTo={redirectTo}
      onSignInAction={async () => {
        'use server'
        await signIn('google', { redirectTo })
      }}
    />
  )
}
