import Link from 'next/link'
import { ArrowLeftIcon, ShieldCheckIcon } from 'lucide-react'
import { Footer } from '@/components/Footer'

export const metadata = {
  title: 'Privacy Policy - Doko',
  description: 'How Doko protects and handles your workspace data.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500/30 selection:text-teal-200 antialiased flex flex-col justify-between relative">
      <div className="max-w-4xl mx-auto px-6 py-12 w-full flex-1">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-150" />
          Back to home
        </Link>

        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-teal-300 font-mono font-semibold bg-teal-500/10 px-3.5 py-1.5 rounded-full border border-teal-500/20">
            <ShieldCheckIcon className="w-4 h-4" />
            Privacy & Trust
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Privacy Policy
          </h1>

          <p className="text-sm font-mono text-slate-400">
            Last updated: July 28, 2026
          </p>

          <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-6 pt-4 font-light">
            <section className="space-y-2 border-b border-white/10 pb-6">
              <h2 className="text-lg font-semibold text-white font-mono uppercase tracking-wider">
                1. Data We Collect
              </h2>
              <p>
                Doko processes ticket state changes, chat activity, and workspace metadata solely to generate your team's daily Morning Brief. We store user profile info (name, email, avatar) provided via Google OAuth.
              </p>
            </section>

            <section className="space-y-2 border-b border-white/10 pb-6">
              <h2 className="text-lg font-semibold text-white font-mono uppercase tracking-wider">
                2. How We Use Data
              </h2>
              <p>
                Your data is processed strictly within Convex database functions and passed to Google Gemini / Anthropic Claude APIs to summarize daily highlights. We never sell your data or use it for third-party advertising.
              </p>
            </section>

            <section className="space-y-2 border-b border-white/10 pb-6">
              <h2 className="text-lg font-semibold text-white font-mono uppercase tracking-wider">
                3. Cookies & Local Storage
              </h2>
              <p>
                We use essential session cookies to maintain your login state. Workspace preferences (such as role filter selections and cookie consent) are saved locally on your device in <code className="text-teal-300">localStorage</code>.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white font-mono uppercase tracking-wider">
                4. Contact
              </h2>
              <p>
                If you have questions regarding data handling or wish to remove your account data, please contact your workspace administrator or reach out via Doko support.
              </p>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
