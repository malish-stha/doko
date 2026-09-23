'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MessageSquareIcon, Loader2Icon } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'

export function StartDMButton({
  userId,
  label = 'Message',
  variant = 'ghost',
  size = 'sm',
  className = '',
}: {
  userId: string
  label?: string
  variant?: 'ghost' | 'outline' | 'default' | 'link'
  size?: 'sm' | 'xs' | 'default' | 'icon'
  className?: string
}) {
  const openDM = useMutation(api.channels.openDM)
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!userId || loading) return
    setLoading(true)
    try {
      const id = await openDM({ otherUserId: userId })
      router.push(`/chat/${id}`)
    } catch (err) {
      console.error('Failed to open DM:', err)
      toast.error('Could not start conversation', parseConvexError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      size={size as any}
      variant={variant as any}
      onClick={handleClick}
      disabled={loading}
      className={`text-xs text-teal-400 hover:text-teal-300 font-mono ${className}`}
    >
      {loading ? (
        <Loader2Icon className="w-3 h-3 animate-spin mr-1" />
      ) : (
        <MessageSquareIcon className="w-3.5 h-3.5 mr-1" />
      )}
      {label}
    </Button>
  )
}
