'use client'

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: '/sign-in' })}
      className="text-xs active:scale-[0.97] transition-all duration-150 cursor-pointer"
    >
      Sign out
    </Button>
  )
}
