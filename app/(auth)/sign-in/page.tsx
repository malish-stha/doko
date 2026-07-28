import { signIn } from '@/auth'
import { SignInClient } from '@/components/auth/SignInClient'

export default function SignInPage() {
  return (
    <SignInClient
      onSignInAction={async () => {
        'use server'
        await signIn('google', { redirectTo: '/board' })
      }}
    />
  )
}

