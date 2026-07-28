'use client'

import Link from 'next/link'
import { openCookieSettings } from '@/components/ui/CookieConsent'
import { SparklesIcon, ShieldCheckIcon, CheckCircle2Icon } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950 text-slate-400 text-xs font-sans relative z-10">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8">
        {/* Brand Summary */}
        <div className="lg:col-span-5 space-y-3">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-sm tracking-tight text-white group active:scale-[0.98] transition-transform duration-150">
            <span className="w-6 h-6 bg-teal-500 text-slate-950 flex items-center justify-center font-mono text-xs font-black rounded-md shadow-xs">
              D
            </span>
            <span className="font-semibold tracking-tight text-white text-base">Doko</span>
          </Link>
          <p className="text-slate-400 max-w-sm leading-relaxed font-light text-xs">
            Doko consolidates Jira tickets and team chat into one AI-driven morning brief. Delivered at 8:00 AM every workday.
          </p>
          <div className="inline-flex items-center gap-2 text-[11px] font-mono text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>All systems operational</span>
          </div>
        </div>

        {/* Product Navigation */}
        <div className="lg:col-span-3 space-y-2.5">
          <div className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-200">
            Product
          </div>
          <ul className="space-y-2 font-mono text-xs">
            <li>
              <Link href="#sample" className="hover:text-white transition-colors">
                Morning Brief
              </Link>
            </li>
            <li>
              <Link href="/board" className="hover:text-white transition-colors">
                Ticket Board
              </Link>
            </li>
            <li>
              <Link href="/chat" className="hover:text-white transition-colors">
                Team Chat
              </Link>
            </li>
            <li>
              <Link href="/sign-in" className="hover:text-teal-300 text-teal-400 transition-colors">
                Sign In →
              </Link>
            </li>
          </ul>
        </div>

        {/* Legal & Trust */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-200">
            Legal & Privacy
          </div>
          <ul className="space-y-2 font-mono text-xs">
            <li>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={openCookieSettings}
                className="hover:text-teal-300 transition-colors text-left cursor-pointer text-slate-400"
              >
                Cookie Preferences
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10 py-6 bg-slate-950/80">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div>© {new Date().getFullYear()} Doko · All rights reserved.</div>
          <div>Doko · Morning Brief App</div>
        </div>
      </div>
    </footer>
  )
}
