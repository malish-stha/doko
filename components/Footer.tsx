'use client'

import Link from 'next/link'
import { openCookieSettings } from '@/components/ui/CookieConsent'

export function Footer() {
  return (
    <footer className="border-t border-border bg-background text-muted-foreground text-xs font-sans relative z-10">
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6 items-start">
        {/* Brand Summary */}
        <div className="lg:col-span-5 space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-sm tracking-tight text-foreground group active:scale-[0.98] transition-transform duration-150">
            <span className="w-5 h-5 bg-teal-400 text-slate-950 flex items-center justify-center font-mono text-[11px] font-black rounded-none shadow-xs">
              D
            </span>
            <span className="font-semibold tracking-tight text-foreground text-sm">Doko</span>
          </Link>
          <p className="text-muted-foreground max-w-sm leading-relaxed text-[11px]">
            Jira tickets and team chat consolidated into one AI-driven morning brief.
          </p>
        </div>

        {/* Product Navigation */}
        <div className="lg:col-span-3 space-y-1.5">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Product
          </div>
          <ul className="space-y-1 font-mono text-[11px]">
            <li>
              <Link href="/board" className="hover:text-foreground transition-colors">
                Ticket Board
              </Link>
            </li>
            <li>
              <Link href="/chat" className="hover:text-foreground transition-colors">
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
        <div className="lg:col-span-4 space-y-1.5">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Legal & Privacy
          </div>
          <ul className="space-y-1 font-mono text-[11px]">
            <li>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={openCookieSettings}
                className="hover:text-teal-400 transition-colors text-left cursor-pointer text-muted-foreground"
              >
                Cookie Preferences
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border/60 py-3 bg-background">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between gap-4 text-[11px] font-mono text-muted-foreground/70">
          <div>© {new Date().getFullYear()} Doko · All rights reserved.</div>
          <div>Doko · Morning Brief App</div>
        </div>
      </div>
    </footer>
  )
}
