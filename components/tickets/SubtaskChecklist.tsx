'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { XIcon, CheckSquareIcon } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'

export function SubtaskChecklist({
  ticketId,
  userEmail,
  onCountChange,
}: {
  ticketId: Id<'tickets'>
  userEmail?: string
  onCountChange?: (doneCount: number, totalCount: number) => void
}) {
  const items = useQuery(api.subtasks.byTicket, { ticketId, userEmail }) ?? []
  const add = useMutation(api.subtasks.add)
  const toggle = useMutation(api.subtasks.toggle)
  const remove = useMutation(api.subtasks.remove)

  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)

  const doneCount = items.filter(i => i.done).length
  const totalCount = items.length
  const progressPercent = totalCount > 0 ? (doneCount / totalCount) * 100 : 0

  const handleAdd = async () => {
    const title = draft.trim()
    if (!title) return
    setAdding(true)
    try {
      await add({ ticketId, title, userEmail })
      setDraft('')
    } catch (err: any) {
      toast.error('Failed to add sub-task', parseConvexError(err))
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (subtaskId: Id<'subtasks'>) => {
    try {
      await toggle({ subtaskId, userEmail })
    } catch (err: any) {
      toast.error('Failed to toggle sub-task', parseConvexError(err))
    }
  }

  const handleRemove = async (subtaskId: Id<'subtasks'>) => {
    try {
      await remove({ subtaskId, userEmail })
    } catch (err: any) {
      toast.error('Failed to remove sub-task', parseConvexError(err))
    }
  }

  return (
    <div className="space-y-3 pt-4 border-t border-border/40">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <CheckSquareIcon className="w-4 h-4 text-teal-400" />
          <span>Sub-tasks ({doneCount} / {totalCount})</span>
        </div>
        {totalCount > 0 && (
          <div className="flex-1 max-w-xs">
            <Progress value={progressPercent} className="h-1.5 bg-muted" />
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-1">
          {items.map(item => (
            <div
              key={item._id}
              className="group flex items-center gap-2 py-1.5 px-2 rounded-none hover:bg-muted/30 transition-colors text-sm"
            >
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => handleToggle(item._id)}
                className="w-4 h-4 rounded border-border text-teal-500 focus:ring-teal-400 cursor-pointer accent-teal-500"
              />
              <span className={`flex-1 ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {item.title}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(item._id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 p-1 transition-opacity"
                title="Remove sub-task"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Input
          placeholder="Add a sub-task (press Enter)"
          value={draft}
          disabled={adding}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          className="text-xs h-8 bg-background border-border/60"
        />
      </div>
    </div>
  )
}
