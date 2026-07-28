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
import { UserAvatar } from '@/components/UserAvatar'
import { HashIcon, SendIcon, UserIcon } from 'lucide-react'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from '@/components/ui/message'

import { Skeleton } from '@/components/ui/skeleton'

export function ChatPane({ channelId }: { channelId: Id<'channels'> }) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const channel = useQuery(api.channels.get, { channelId, userEmail })

  const rawMessages = useQuery(api.messages.byChannel, { channelId })
  const messages = rawMessages ?? []
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {rawMessages === undefined ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3 p-2">
                <Skeleton className="w-8 h-8 rounded-none shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length > 0 ? (
          <MessageGroup className="space-y-4">
            {messages.map(m => {
              const isSelf = m.authorEmail === userEmail || m.authorId === userEmail

              return (
                <MessageContextMenu key={m._id} message={m}>
                  <motion.div
                    initial={shouldReduceMotion ? {} : { y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Message align={isSelf ? 'end' : 'start'} className="group/item hover:bg-muted/20 p-2.5 rounded-xl transition-colors gap-3 items-start">
                      <MessageAvatar className="bg-transparent overflow-visible shrink-0 pt-0.5">
                        <UserAvatar
                          user={{
                            avatarUrl: m.avatarUrl,
                            name: m.authorName || m.authorId,
                            email: m.authorEmail || (m.authorId.includes('@') ? m.authorId : undefined),
                            userId: m.authorId,
                          }}
                          seed={m.authorEmail || m.authorId || m._id}
                          size="md"
                          className="shrink-0"
                        />
                      </MessageAvatar>

                      <MessageContent className={isSelf ? 'items-end' : 'items-start'}>
                        <MessageHeader className="gap-2 px-0 text-[11px] font-mono normal-case tracking-normal mb-1">
                          <span className="font-semibold text-foreground">
                            {m.authorName || m.authorId}
                          </span>
                          <span className="text-muted-foreground/60 font-mono text-[10px]">
                            {formatDistanceToNow(new Date(m.createdAt))} ago
                          </span>
                        </MessageHeader>

                        <Bubble align={isSelf ? 'end' : 'start'} variant={isSelf ? 'default' : 'secondary'}>
                          <BubbleContent className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            isSelf
                              ? 'bg-teal-400 text-slate-950 font-medium shadow-md shadow-teal-500/10'
                              : 'bg-muted/90 text-foreground border border-white/10'
                          }`}>
                            {m.body}
                          </BubbleContent>
                        </Bubble>

                        <MessageFooter className="px-0 pt-1">
                          <ReactionList messageId={m._id} />
                        </MessageFooter>
                      </MessageContent>
                    </Message>
                  </motion.div>
                </MessageContextMenu>
              )
            })}
          </MessageGroup>
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

      {/* Composer Box */}
      <div className="border-t border-border bg-muted/40 w-full shrink-0 p-3">
        <div className="w-full relative border border-border bg-background shadow-xs overflow-hidden focus-within:border-teal-500/50 transition-colors">
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
            rows={3}
            className="w-full resize-none text-sm bg-transparent border-0 focus-visible:ring-0 px-4 py-3 leading-relaxed text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/50 text-xs text-muted-foreground">
            <span className="text-[11px] font-mono text-muted-foreground">
              Press <kbd className="font-mono bg-muted text-foreground px-1.5 py-0.5 rounded-none border border-border text-[10px]">Enter</kbd> to send,{' '}
              <kbd className="font-mono bg-muted text-foreground px-1.5 py-0.5 rounded-none border border-border text-[10px]">Shift+Enter</kbd> for newline
            </span>
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                size="sm"
                onClick={submit}
                disabled={!draft.trim() || submitting}
                className="h-8 px-4 text-xs font-semibold uppercase tracking-wider bg-teal-400 text-slate-950 hover:bg-teal-300 gap-1.5 rounded-none disabled:opacity-40 shadow-xs cursor-pointer"
              >
                <SendIcon className="w-3.5 h-3.5" />
                {submitting ? 'Sending…' : 'Send'}
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
