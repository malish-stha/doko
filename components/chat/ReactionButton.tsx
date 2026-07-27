'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { motion, useReducedMotion } from 'motion/react'

const QUICK_EMOJIS = ['👍', '❤️', '🚀', '👀', '🎉']

export function ReactionList({ messageId }: { messageId: Id<'messages'> }) {
  const reactions = useQuery(api.reactions.byMessage, { messageId }) ?? []
  const toggle = useMutation(api.reactions.toggle)
  const shouldReduceMotion = useReducedMotion()

  // Group reactions by emoji
  const counts: Record<string, number> = {}
  reactions.forEach(r => {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1
  })

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      {Object.entries(counts).map(([emoji, count]) => (
        <motion.button
          key={emoji}
          type="button"
          initial={shouldReduceMotion ? {} : { scale: 0.6 }}
          animate={{ scale: [0.6, 1.15, 1.0] }}
          transition={{ duration: 0.18 }}
          onClick={() => toggle({ messageId, emoji })}
          className="inline-flex items-center gap-1 text-xs border px-1.5 py-0.5 rounded-none bg-muted/50 hover:bg-muted transition-colors font-mono select-none"
        >
          <span>{emoji}</span>
          <span className="text-[10px] text-muted-foreground">{count}</span>
        </motion.button>
      ))}

      <div className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-0.5 ml-1">
        {QUICK_EMOJIS.map(emoji => (
          <button
            key={emoji}
            type="button"
            onClick={() => toggle({ messageId, emoji })}
            className="text-xs p-0.5 hover:bg-muted rounded transition-transform hover:scale-125"
            title={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
