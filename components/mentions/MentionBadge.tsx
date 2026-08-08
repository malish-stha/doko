'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserAvatar } from '@/components/UserAvatar'
import { MailIcon, BriefcaseIcon } from 'lucide-react'

export function MentionBadge({
  userId,
  label,
  userEmail,
}: {
  userId: string
  label: string
  userEmail?: string
}) {
  const user = useQuery(api.users.getByUserId, { userId })

  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-0.5 bg-teal-500/20 text-teal-400 font-medium px-1.5 py-0.5 rounded-none text-xs hover:bg-teal-500/30 transition-colors cursor-pointer">
        @{label}
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3 bg-card border-border shadow-lg" align="start">
        <div className="flex items-center gap-3">
          <UserAvatar
            name={user?.name || label}
            avatarUrl={user?.avatarUrl}
            email={user?.email}
            className="w-10 h-10 border border-border"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.name || label}</div>
            {user?.jobTitle && (
              <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <BriefcaseIcon className="w-3 h-3 shrink-0" />
                <span>{user.jobTitle}</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <MailIcon className="w-3 h-3 shrink-0" />
              <span>{user?.email || userId}</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
