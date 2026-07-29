'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { SunIcon, MoonIcon, LaptopIcon } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={`w-8 h-8 rounded-none border border-border bg-card opacity-50 ${className}`} />
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={`w-8 h-8 rounded-none border border-border/80 bg-card/60 hover:bg-muted text-foreground hover:text-teal-500 transition-colors relative cursor-pointer ${className}`}
            title={`Current theme: ${theme}. Click to switch theme.`}
            aria-label="Toggle theme"
          >
            <SunIcon className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
            <MoonIcon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-teal-400" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        }
      />
      <PopoverContent align="end" className="w-36 p-1 rounded-none bg-background border border-border shadow-xl font-sans flex flex-col gap-0.5 z-50">
        <button
          type="button"
          onClick={() => {
            setTheme('light')
            setOpen(false)
          }}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted cursor-pointer text-left ${
            theme === 'light' ? 'text-teal-600 dark:text-teal-400 font-semibold bg-teal-500/10' : 'text-foreground'
          }`}
        >
          <SunIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Light</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTheme('dark')
            setOpen(false)
          }}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted cursor-pointer text-left ${
            theme === 'dark' ? 'text-teal-600 dark:text-teal-400 font-semibold bg-teal-500/10' : 'text-foreground'
          }`}
        >
          <MoonIcon className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <span>Dark</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTheme('system')
            setOpen(false)
          }}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted cursor-pointer text-left ${
            theme === 'system' ? 'text-teal-600 dark:text-teal-400 font-semibold bg-teal-500/10' : 'text-foreground'
          }`}
        >
          <LaptopIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span>System</span>
        </button>
      </PopoverContent>
    </Popover>
  )
}
