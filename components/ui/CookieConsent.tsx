'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { CookieIcon, XIcon, ShieldCheckIcon } from 'lucide-react'
import Link from 'next/link'

const EASE_OUT = [0.23, 1, 0.32, 1] as const
const STORAGE_KEY = 'doko_cookie_consent'

export function CookieConsent() {
  const [consent, setConsent] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const savedConsent = localStorage.getItem(STORAGE_KEY)
    if (savedConsent) {
      setConsent(savedConsent)
    } else {
      // Short delay after mounting so banner slides in smoothly after page load
      const timer = setTimeout(() => setIsOpen(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const handleOpenSettings = () => {
      setIsOpen(true)
    }
    window.addEventListener('doko-open-cookie-settings', handleOpenSettings)
    return () => window.removeEventListener('doko-open-cookie-settings', handleOpenSettings)
  }, [])

  const handleAcceptAll = () => {
    localStorage.setItem(STORAGE_KEY, 'all')
    setConsent('all')
    setIsOpen(false)
  }

  const handleRejectNonEssential = () => {
    localStorage.setItem(STORAGE_KEY, 'essential')
    setConsent('essential')
    setIsOpen(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(4px)' }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="fixed bottom-5 right-5 left-5 sm:left-auto sm:max-w-md z-50 p-5 rounded-2xl bg-slate-900/95 border border-teal-500/30 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 text-slate-100 text-xs font-sans"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
                <CookieIcon className="w-4 h-4" />
              </div>
              <span>Cookie & Privacy Preferences</span>
            </div>
            <button
              type="button"
              onClick={handleRejectNonEssential}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
              title="Close cookie notice"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Body Description */}
          <p className="text-slate-300 leading-relaxed mb-4 font-light">
            Doko uses essential cookies to authenticate your session and save workspace preferences. We do not use intrusive cross-site tracking cookies.{' '}
            <Link href="/privacy" className="text-teal-400 underline hover:text-teal-300">
              Read Privacy Policy
            </Link>
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 justify-end pt-1">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15, ease: EASE_OUT }}
              onClick={handleRejectNonEssential}
              className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
            >
              Essential Only
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15, ease: EASE_OUT }}
              onClick={handleAcceptAll}
              className="px-4 py-2 rounded-xl bg-teal-400 text-slate-950 font-semibold font-mono text-[11px] uppercase tracking-wider hover:bg-teal-300 transition-colors shadow-md shadow-teal-500/20 cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheckIcon className="w-3.5 h-3.5" />
              Accept All
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function openCookieSettings() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('doko-open-cookie-settings'))
  }
}
