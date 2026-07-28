import { createAvatar } from '@dicebear/core'
import * as thumbs from '@dicebear/thumbs'

export interface UserLike {
  avatarUrl?: string | null
  name?: string | null
  email?: string | null
  userId?: string | null
  id?: string | null
}

export interface ThumbsAvatarOptions {
  backgroundColor?: string[]
  rotate?: number
  scale?: number
  radius?: number
}

function safeSvgToBase64(svgStr: string): string {
  if (typeof globalThis !== 'undefined' && typeof globalThis.btoa === 'function') {
    return globalThis.btoa(
      encodeURIComponent(svgStr).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    )
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(svgStr).toString('base64')
  }
  return encodeURIComponent(svgStr)
}

/**
 * Generate a clean SVG Data URI using @dicebear/core and @dicebear/thumbs style.
 * Safe across Node, Browser, Edge, and Convex V8 runtimes.
 */
export function getDiceBearThumbsAvatar(seed: string, options?: ThumbsAvatarOptions): string {
  const cleanSeed = seed && seed.trim().length > 0 ? seed.trim().toLowerCase() : 'doko-user'

  const avatar = createAvatar(thumbs, {
    seed: cleanSeed,
    ...options,
  })

  const svgStr = avatar.toString()
  const base64 = safeSvgToBase64(svgStr)

  return `data:image/svg+xml;base64,${base64}`
}

/**
 * Returns a unique avatar URL or Data URI for any user object.
 * Prioritizes user.avatarUrl if explicitly set by user.
 * Otherwise generates a unique @dicebear/thumbs SVG Data URI using user email, userId, or name.
 */
export function getAvatarUrl(user?: UserLike | null, fallbackSeed?: string): string {
  if (user?.avatarUrl && user.avatarUrl.trim().length > 0 && !user.avatarUrl.includes('doko-user')) {
    return user.avatarUrl
  }

  // Ensure unique seed per user!
  const uniqueSeed =
    user?.email?.trim() ||
    user?.userId?.trim() ||
    user?.id?.trim() ||
    user?.name?.trim() ||
    fallbackSeed?.trim() ||
    'doko-user'

  return getDiceBearThumbsAvatar(uniqueSeed)
}

export const PRESET_BACKGROUND_COLORS = [
  { name: 'Default Teal', value: ['0f766e', '134e4a', '115e59'] },
  { name: 'Ocean Cyan', value: ['0891b2', '0e7490', '155e75'] },
  { name: 'Indigo Night', value: ['4338ca', '3730a3', '312e81'] },
  { name: 'Sunset Amber', value: ['d97706', 'b45309', '92400e'] },
  { name: 'Emerald Forest', value: ['059669', '047857', '065f46'] },
  { name: 'Rose Quartz', value: ['e11d48', 'be123c', '9f1239'] },
  { name: 'Violet Glow', value: ['7c3aed', '6d28d9', '5b21b6'] },
  { name: 'Slate Gray', value: ['334155', '1e293b', '0f172a'] },
]
