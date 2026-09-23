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
  showCheatSheet: () => void
}

const HotkeyCtx = createContext<HotkeyContextType | null>(null)

const INTERACTIVE_ROLES = new Set(['button', 'link', 'menuitem', 'option', 'tab', 'switch', 'checkbox', 'radio', 'combobox', 'textbox', 'slider', 'spinbutton', 'listbox'])

/**
 * True when a single-key hotkey must NOT fire: the user is typing, or has
 * focus on an interactive control where the key has its own meaning
 * (Enter/Space on a button, arrows in a select, Escape in a dialog...).
 */
export function isTypingContext(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.activeElement as HTMLElement | null
  if (!el || el === document.body) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') {
    return true
  }
  if (el.isContentEditable) return true
  const role = el.getAttribute('role')
  if (role && INTERACTIVE_ROLES.has(role)) return true
  return el.closest('[role="dialog"], [role="menu"], [role="listbox"]') !== null
}

/** Canonical spelling for a key name so specs and events compare equal. */
function normalizeKeyName(key: string): string {
  const k = key.toLowerCase()
  if (k === ' ' || k === 'spacebar') return 'space'
  if (k === 'escape') return 'esc'
  if (k === 'return') return 'enter'
  return k
}

function matchesSingleKey(event: KeyboardEvent, keySpec: string): boolean {
  const parts = keySpec.toLowerCase().split('+').map(p => p.trim())
  const mods = parts.filter(p => ['mod', 'cmd', 'ctrl', 'shift', 'alt', 'meta'].includes(p))
  const mainKeyRaw = parts.filter(p => !mods.includes(p))[0]
  if (!mainKeyRaw) return false
  const mainKey = normalizeKeyName(mainKeyRaw)

  if (normalizeKeyName(event.key) !== mainKey) return false

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
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
  // Bindings live in a ref: registering a hotkey must not re-render the whole app.
  const bindingsRef = useRef<Binding[]>([])
  const [cheatOpen, setCheatOpen] = useState(false)
  const [cheatBindings, setCheatBindings] = useState<Binding[]>([])
  const keyBufferRef = useRef<{ key: string; time: number } | null>(null)

  const register = useCallback((b: Omit<Binding, 'enabled'> & { enabled?: boolean }) => {
    const binding: Binding = { ...b, enabled: b.enabled ?? true }
    bindingsRef.current = [
      ...bindingsRef.current.filter(x => x.keys !== binding.keys || x.scope !== binding.scope),
      binding,
    ]
    return () => {
      bindingsRef.current = bindingsRef.current.filter(x => x !== binding)
    }
  }, [])

  const showCheatSheet = useCallback(() => {
    setCheatBindings([...bindingsRef.current])
    setCheatOpen(true)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return

      if (event.key === '?' && !isTypingContext()) {
        event.preventDefault()
        showCheatSheet()
        return
      }

      const now = Date.now()
      const currentKey = normalizeKeyName(event.key)
      const typing = isTypingContext()

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
        const usesMod = /(^|\+)(mod|cmd|ctrl|meta)\+/.test(keysLower)

        // Single-key shortcuts never steal keystrokes from inputs or focused controls.
        if (typing && !usesMod) continue

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

      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
        keyBufferRef.current = { key: currentKey, time: now }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showCheatSheet])

  const value = useMemo(() => ({ register, showCheatSheet }), [register, showCheatSheet])

  return (
    <HotkeyCtx.Provider value={value}>
      {children}
      <HotkeysCheatSheet open={cheatOpen} onOpenChange={setCheatOpen} bindings={cheatBindings} />
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

  // Latest handler without re-registering; written in an effect, never during render.
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

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
