'use client'

import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { BoldIcon, ItalicIcon, CodeIcon, ListIcon, CheckSquareIcon, HeadingIcon } from 'lucide-react'

export function DescriptionEditor({
  initialValue,
  onSave,
}: {
  initialValue: string
  onSave: (val: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write')
  const [value, setValue] = useState(initialValue ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertText = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const current = textarea.value
    const selected = current.substring(start, end)
    const replacement = `${prefix}${selected || 'text'}${suffix}`
    const updated = current.substring(0, start) + replacement + current.substring(end)

    setValue(updated)
    onSave(updated)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 4))
    }, 0)
  }

  const handleBlur = () => {
    if (value !== initialValue) {
      onSave(value)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-none border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === 'write'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === 'preview'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Preview
          </button>
        </div>

        {activeTab === 'write' && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => insertText('**', '**')}
              title="Bold"
            >
              <BoldIcon className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => insertText('_', '_')}
              title="Italic"
            >
              <ItalicIcon className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => insertText('`', '`')}
              title="Code"
            >
              <CodeIcon className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => insertText('- ')}
              title="Bullet List"
            >
              <ListIcon className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => insertText('[ ] ')}
              title="Task list"
            >
              <CheckSquareIcon className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => insertText('### ')}
              title="Heading"
            >
              <HeadingIcon className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {activeTab === 'write' ? (
        <div>
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={handleBlur}
            rows={8}
            placeholder="Add a description... (Markdown supported, use @ to mention teammates)"
            className="font-mono text-xs bg-background border-border/60 focus-visible:ring-teal-400"
          />
          <div className="text-[10px] text-muted-foreground mt-1">
            Markdown supported. Tables via | pipes |. Changes save automatically.
          </div>
        </div>
      ) : (
        <div className="p-3 bg-muted/10 border border-border/40 min-h-[160px] text-xs text-foreground prose prose-invert prose-xs max-w-none">
          {value ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {value}
            </ReactMarkdown>
          ) : (
            <span className="italic text-muted-foreground">No description provided</span>
          )}
        </div>
      )}
    </div>
  )
}
