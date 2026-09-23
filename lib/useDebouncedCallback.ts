'use client'

import { useEffect, useMemo, useRef } from 'react'

/**
 * Returns a stable function that invokes `fn` `delayMs` after the last call.
 * Pending calls are dropped on unmount. Used to avoid a router navigation
 * per keystroke in URL-backed filter inputs.
 */
export function useDebouncedCallback<Args extends unknown[]>(fn: (...args: Args) => void, delayMs: number) {
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return useMemo(() => {
    const debounced = (...args: Args) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = null
        fnRef.current(...args)
      }, delayMs)
    }
    debounced.flush = (...args: Args) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      fnRef.current(...args)
    }
    return debounced
  }, [delayMs])
}
