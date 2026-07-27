'use client'

import { use } from 'react'
import { ChatPane } from '@/components/chat/ChatPane'
import type { Id } from '@/convex/_generated/dataModel'

export default function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>
}) {
  const resolvedParams = use(params)
  return <ChatPane channelId={resolvedParams.channelId as Id<'channels'>} />
}
