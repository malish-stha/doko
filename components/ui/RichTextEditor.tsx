'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  BoldIcon,
  ItalicIcon,
  CodeIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  Heading2Icon,
  EyeIcon,
  Edit3Icon,
  SparklesIcon,
  CheckIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const EASE_OUT = [0.23, 1, 0.32, 1] as const

interface RichTextEditorProps {
  value: string
  onChange: (val: string) => void
  onBlur?: () => void
  placeholder?: string
  minHeight?: string
  className?: string
  autoFocus?: boolean
  label?: string
  readOnly?: boolean
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = 'Write details here...',
  minHeight = '140px',
  className,
  autoFocus = false,
  label,
  readOnly = false,
}: RichTextEditorProps) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertFormatting = (prefix: string, suffix: string = prefix, defaultText: string = 'text') => {
    const el = textareaRef.current
    if (!el) return

    const start = el.selectionStart
    const end = el.selectionEnd
    const selectedText = value.substring(start, end) || defaultText
    const replacement = `${prefix}${selectedText}${suffix}`

    const newValue = value.substring(0, start) + replacement + value.substring(end)
    onChange(newValue)

    // Reset cursor position after insert
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length)
    }, 10)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'b') {
        e.preventDefault()
        insertFormatting('**', '**', 'bold text')
      } else if (e.key === 'i') {
        e.preventDefault()
        insertFormatting('*', '*', 'italic text')
      } else if (e.key === 'e') {
        e.preventDefault()
        insertFormatting('`', '`', 'code')
      }
    }
  }

  return (
    <div className={cn('rounded-none border border-border bg-background shadow-xs overflow-hidden font-sans', className)}>
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 flex-wrap gap-2">
        {/* Formatting Action Buttons */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => insertFormatting('**', '**', 'bold text')}
            title="Bold (⌘B)"
            disabled={activeTab === 'preview' || readOnly}
          >
            <BoldIcon className="w-3.5 h-3.5" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => insertFormatting('*', '*', 'italic text')}
            title="Italic (⌘I)"
            disabled={activeTab === 'preview' || readOnly}
          >
            <ItalicIcon className="w-3.5 h-3.5" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => insertFormatting('`', '`', 'code')}
            title="Inline Code (⌘E)"
            disabled={activeTab === 'preview' || readOnly}
          >
            <CodeIcon className="w-3.5 h-3.5" />
          </ToolbarButton>

          <div className="w-px h-4 bg-border mx-1" />

          <ToolbarButton
            onClick={() => insertFormatting('## ', '', 'Heading')}
            title="Heading"
            disabled={activeTab === 'preview' || readOnly}
          >
            <Heading2Icon className="w-3.5 h-3.5" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => insertFormatting('- ', '', 'List item')}
            title="Bullet List"
            disabled={activeTab === 'preview' || readOnly}
          >
            <ListIcon className="w-3.5 h-3.5" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => insertFormatting('> ', '', 'Quote')}
            title="Blockquote"
            disabled={activeTab === 'preview' || readOnly}
          >
            <QuoteIcon className="w-3.5 h-3.5" />
          </ToolbarButton>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-none border border-border text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`relative px-2.5 py-1 rounded-none transition-colors flex items-center gap-1 cursor-pointer ${
              activeTab === 'write' ? 'text-teal-400 font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {activeTab === 'write' && (
              <motion.div
                layoutId="editorTab"
                className="absolute inset-0 bg-teal-500/20 border border-teal-500/40 rounded-none"
                transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
              />
            )}
            <Edit3Icon className="w-3 h-3 relative z-10" />
            <span className="relative z-10">Write</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`relative px-2.5 py-1 rounded-none transition-colors flex items-center gap-1 cursor-pointer ${
              activeTab === 'preview' ? 'text-teal-400 font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {activeTab === 'preview' && (
              <motion.div
                layoutId="editorTab"
                className="absolute inset-0 bg-teal-500/20 border border-teal-500/40 rounded-none"
                transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
              />
            )}
            <EyeIcon className="w-3 h-3 relative z-10" />
            <span className="relative z-10">Preview</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <AnimatePresence mode="wait">
        {activeTab === 'write' ? (
          <motion.div
            key="write"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={e => onChange(e.target.value)}
              onBlur={onBlur}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoFocus={autoFocus}
              readOnly={readOnly}
              style={{ minHeight }}
              className="w-full p-4 bg-background text-foreground placeholder:text-muted-foreground/60 text-sm leading-relaxed outline-none resize-y font-sans border-0 focus:ring-0"
            />
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{ minHeight }}
            className="p-4 bg-background text-foreground text-sm leading-relaxed overflow-y-auto"
          >
            {value.trim() ? (
              <MarkdownRenderer content={value} />
            ) : (
              <span className="text-muted-foreground font-mono text-xs italic">Nothing to preview</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ToolbarButton({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  disabled?: boolean
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded-none text-muted-foreground hover:text-teal-400 hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
    >
      {children}
    </motion.button>
  )
}

function MarkdownRenderer({ content }: { content: string }) {
  // Simple markdown renderer for preview tab
  const lines = content.split('\n')

  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        if (line.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-base font-bold text-white pt-1">
              {line.replace('## ', '')}
            </h2>
          )
        }
        if (line.startsWith('> ')) {
          return (
            <blockquote key={idx} className="border-l-2 border-teal-400 pl-3 py-1 text-slate-300 italic bg-teal-500/5 rounded-r">
              {line.replace('> ', '')}
            </blockquote>
          )
        }
        if (line.startsWith('- ')) {
          return (
            <div key={idx} className="flex items-center gap-2 text-slate-300 pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
              <span>{formatFormattedText(line.replace('- ', ''))}</span>
            </div>
          )
        }
        return (
          <p key={idx} className="text-slate-200">
            {formatFormattedText(line)}
          </p>
        )
      })}
    </div>
  )
}

function formatFormattedText(text: string) {
  // Basic bold/italic inline parsing
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g)

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={i} className="italic text-teal-200">
          {part.slice(1, -1)}
        </em>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="font-mono text-xs bg-slate-800 text-teal-300 px-1.5 py-0.5 rounded border border-white/10">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}
