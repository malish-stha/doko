'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export function CommentForm({ ticketId }: { ticketId: Id<'tickets'> }) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const authorName = session?.user?.name ?? session?.user?.email ?? undefined

  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)
  const add = useMutation(api.comments.add)

  const submit = async () => {
    if (!body.trim() || pending) return
    setPending(true)
    try {
      await add({
        ticketId,
        body: body.trim(),
        userEmail,
        authorName,
      })
      setBody('')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Add a comment…"
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={3}
        className="resize-y text-sm"
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            submit()
          }
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/60">
          Press <kbd className="font-mono bg-muted px-1 rounded">⌘Enter</kbd> to post
        </span>
        <Button size="sm" onClick={submit} disabled={!body.trim() || pending}>
          {pending ? 'Posting…' : 'Post comment'}
        </Button>
      </div>
    </div>
  )
}
