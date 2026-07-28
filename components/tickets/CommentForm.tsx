'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'

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
      toast.success('Comment posted')
      setBody('')
    } catch (err: any) {
      console.error('Failed to post comment:', err)
      toast.error('Failed to post comment', err?.message ?? 'Could not add comment.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <RichTextEditor
        placeholder="Add a formatted comment (supports **bold**, *italic*, `code`, lists)..."
        value={body}
        onChange={setBody}
        minHeight="110px"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/60 font-mono">
          Formatting options available above • Markdown supported
        </span>
        <Button size="sm" onClick={submit} disabled={!body.trim() || pending} className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold">
          {pending ? 'Posting…' : 'Post comment'}
        </Button>
      </div>
    </div>
  )
}
