'use client'

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { HotkeysCheatSheet } from '@/components/hotkeys/HotkeysCheatSheet'

export type Handler = () => void
export type Binding = {
  keys: string
  description?: string
  handler: Handler
  scope?: string
  enabled: boolean
}

interface HotkeyContextType {
  register: (b: Omit<Binding, 'enabled'> & { enabled?: boolean }) => () => void
  bindings: Binding[]
  showCheatSheet: () => void
}

const HotkeyCtx = createContext<HotkeyContextType | null>(null)

function isTypingContext(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

function matchesSingleKey(event: KeyboardEvent, keySpec: string): boolean {
  const parts = keySpec.toLowerCase().split('+').map(p => p.trim())
  const mods = parts.filter(p => ['mod', 'cmd', 'ctrl', 'shift', 'alt', 'meta'].includes(p))
  const mainKey = parts.filter(p => !mods.includes(p))[0]?.toLowerCase()

  if (!mainKey) return false

  let eventKey = event.key.toLowerCase()
  if (eventKey === ' ') eventKey = 'space'
  if (eventKey === 'escape') eventKey = 'esc'

  if (eventKey !== mainKey) return false

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
  const wantCmd = mods.includes('mod') || mods.includes('cmd') || mods.includes('meta')
  const wantCtrl = mods.includes('ctrl')
  const wantShift = mods.includes('shift')
  const wantAlt = mods.includes('alt')

  const modActive = isMac ? event.metaKey : event.ctrlKey

  if (wantCmd && !modActive) return false
  if (!wantCmd && !wantCtrl && modActive) return false
  if (wantShift !== event.shiftKey) return false
  if (wantAlt !== event.altKey) return false

  return true
}

export function HotkeyProvider({ children }: { children: React.ReactNode }) {
  const [bindings, setBindings] = useState<Binding[]>([])
  const [cheatOpen, setCheatOpen] = useState(false)
  const keyBufferRef = useRef<{ key: string; time: number } | null>(null)
  const bindingsRef = useRef<Binding[]>([])

  useEffect(() => {
    bindingsRef.current = bindings
  }, [bindings])

  const register = useCallback((b: Omit<Binding, 'enabled'> & { enabled?: boolean }) => {
    const binding: Binding = { ...b, enabled: b.enabled ?? true }
    setBindings(prev => [...prev.filter(x => x.keys !== binding.keys || x.scope !== binding.scope), binding])
    return () => {
      setBindings(prev => prev.filter(x => x !== binding))
    }
  }, [])

  const showCheatSheet = useCallback(() => {
    setCheatOpen(true)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '?' && !isTypingContext()) {
        event.preventDefault()
        setCheatOpen(true)
        return
      }

      const now = Date.now()
      const currentKey = event.key.toLowerCase()

      let chordMatchStr: string | null = null
      if (keyBufferRef.current && now - keyBufferRef.current.time < 800) {
        chordMatchStr = `${keyBufferRef.current.key} ${currentKey}`
      }

      const currentBindings = bindingsRef.current
      for (let i = currentBindings.length - 1; i >= 0; i--) {
        const b = currentBindings[i]
        if (!b.enabled) continue

        const keysLower = b.keys.toLowerCase().trim()
        const isChord = keysLower.includes(' ')
        const usesMod = keysLower.includes('mod+') || keysLower.includes('cmd+') || keysLower.includes('ctrl+')

        if (isTypingContext() && !usesMod) continue

        if (isChord && chordMatchStr && chordMatchStr === keysLower) {
          event.preventDefault()
          b.handler()
          keyBufferRef.current = null
          return
        } else if (!isChord && matchesSingleKey(event, keysLower)) {
          event.preventDefault()
          b.handler()
          keyBufferRef.current = null
          return
        }
      }

      if (!isTypingContext() && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
        keyBufferRef.current = { key: currentKey, time: now }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo(
    () => ({
      register,
      bindings,
      showCheatSheet,
    }),
    [register, bindings, showCheatSheet],
  )

  return (
    <HotkeyCtx.Provider value={value}>
      {children}
      <HotkeysCheatSheet open={cheatOpen} onOpenChange={setCheatOpen} bindings={bindings} />
    </HotkeyCtx.Provider>
  )
}

export function useHotkey(
  keys: string,
  handler: Handler,
  options?: { description?: string; scope?: string; enabled?: boolean },
) {
  const ctx = useContext(HotkeyCtx)
  if (!ctx) throw new Error('useHotkey must be used within HotkeyProvider')

  const handlerRef = useRef(handler)
  handlerRef.current = handler

  const registerFn = ctx.register
  const description = options?.description
  const scope = options?.scope
  const enabled = options?.enabled

  useEffect(() => {
    return registerFn({
      keys,
      handler: () => handlerRef.current(),
      description,
      scope,
      enabled: enabled ?? true,
    })
  }, [keys, description, scope, enabled, registerFn])
}

export function useHotkeyCheatSheet() {
  const ctx = useContext(HotkeyCtx)
  if (!ctx) throw new Error('useHotkeyCheatSheet must be used within HotkeyProvider')
  return ctx.showCheatSheet
}
