'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { motion, useReducedMotion } from 'motion/react'
import { MessageContextMenu } from './MessageContextMenu'
import { ReactionList } from './ReactionButton'
import { ChatHeader } from './ChatHeader'
import { HashIcon, SendIcon, UserIcon } from 'lucide-react'

export function ChatPane({ channelId }: { channelId: Id<'channels'> }) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const channel = useQuery(api.channels.get, { channelId, userEmail })

  const messages = useQuery(api.messages.byChannel, { channelId }) ?? []
  const send = useMutation(api.messages.send)

  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length])

  const submit = async () => {
    if (!draft.trim() || submitting) return
    setSubmitting(true)
    try {
      await send({
        channelId,
        body: draft.trim(),
        authorName: session?.user?.name ?? session?.user?.email ?? undefined,
        userEmail,
      })
      setDraft('')
    } finally {
      setSubmitting(false)
    }
  }

  const isDM = channel?.kind === 'dm'

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-background">
      {/* Channel Header */}
      <ChatHeader channelId={channelId} />

      {/* Messages Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length > 0 ? (
          messages.map(m => (
            <MessageContextMenu key={m._id} message={m}>
              <motion.div
                initial={shouldReduceMotion ? {} : { y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="group flex gap-3 p-2 -mx-2 hover:bg-muted/40 transition-colors rounded-none cursor-context-menu"
              >
                <div className="w-8 h-8 rounded-none bg-teal-500/20 text-teal-300 font-mono flex items-center justify-center text-xs font-semibold uppercase shrink-0 border border-teal-500/30">
                  {m.authorId.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono font-medium text-foreground">
                      {m.authorId}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {formatDistanceToNow(new Date(m.createdAt))} ago
                    </span>
                  </div>
                  <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                    {m.body}
                  </div>

                  {/* Reaction List */}
                  <ReactionList messageId={m._id} />
                </div>
              </motion.div>
            </MessageContextMenu>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            {isDM ? (
              <UserIcon className="w-8 h-8 mb-2 opacity-30 text-teal-400" />
            ) : (
              <HashIcon className="w-8 h-8 mb-2 opacity-30 text-teal-400" />
            )}
            <p className="text-sm font-medium">
              {isDM
                ? `Direct message with ${channel?.name ?? 'teammate'}`
                : `Welcome to #${channel?.name ?? 'channel'}!`}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {isDM
                ? 'This is the start of your 1:1 direct message conversation.'
                : `This is the start of the #${channel?.name ?? 'channel'} channel.`}
            </p>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="p-4 border-t border-border bg-card">
        <div className="space-y-2">
          <Textarea
            placeholder={
              isDM
                ? `Message ${channel?.name ?? 'teammate'}…`
                : `Message #${channel?.name ?? 'channel'}…`
            }
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={2}
            className="resize-none text-sm bg-background"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="text-[11px] text-muted-foreground/60">
              Press <kbd className="font-mono bg-muted px-1 rounded">Enter</kbd> to send,{' '}
              <kbd className="font-mono bg-muted px-1 rounded">Shift+Enter</kbd> for newline
            </span>
            <Button
              size="sm"
              onClick={submit}
              disabled={!draft.trim() || submitting}
              className="h-7 px-3 text-xs gap-1.5"
            >
              <SendIcon className="w-3 h-3" />
              {submitting ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
