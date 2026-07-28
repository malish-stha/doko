'use client'

import React, { useState, useId } from 'react'
import { getDiceBearThumbsAvatar, type UserLike } from '@/lib/dicebear'
import { cn } from '@/lib/utils'

export interface UserAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  user?: UserLike | null
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
  seed?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  alt?: string
}

const sizeClasses: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-14 h-14 text-base',
  '2xl': 'w-20 h-20 text-2xl',
}

export function UserAvatar({
  user,
  name,
  email,
  avatarUrl,
  seed,
  size = 'md',
  alt,
  className,
  ...props
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false)
  const autoId = useId()

  const displayName = name ?? user?.name ?? ''
  const displayEmail = email ?? user?.email ?? ''
  const effectiveUserId = user?.userId ?? user?.id ?? ''

  // Derive unique seed phrase for @dicebear/thumbs character
  const effectiveSeed =
    seed?.trim() ||
    displayEmail.trim() ||
    effectiveUserId.trim() ||
    displayName.trim() ||
    alt?.trim() ||
    `avatar-instance-${autoId}`

  const customAvatarUrl = avatarUrl ?? user?.avatarUrl

  // Use customAvatarUrl if provided and hasn't errored out; otherwise compute @dicebear/thumbs Base64 SVG Data URI!
  const src =
    !imageError && customAvatarUrl && customAvatarUrl.trim().length > 0 && !customAvatarUrl.includes('doko-user')
      ? customAvatarUrl
      : getDiceBearThumbsAvatar(effectiveSeed)

  return (
    <div
      className={cn(
        'relative rounded-none bg-teal-500/20 text-teal-300 font-mono flex items-center justify-center font-bold uppercase border border-teal-500/30 overflow-hidden shrink-0 select-none shadow-xs',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <img
        src={src}
        alt={alt ?? displayName ?? displayEmail ?? 'User avatar'}
        onError={() => setImageError(true)}
        className="w-full h-full object-cover"
      />
    </div>
  )
}
