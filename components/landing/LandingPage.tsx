'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import {
  SparklesIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  ZapIcon,
  BellOffIcon,
  CopyIcon,
  CheckIcon,
  CodeIcon,
  UserCheckIcon,
  CoffeeIcon,
} from 'lucide-react'

const SAMPLE_BRIEFS = {
  dev: {
    role: 'Software Engineer',
    icon: CodeIcon,
    date: 'Monday, July 27',
    body: 'Priya shipped the auth refactor yesterday. Marco is still blocked on the S3 permissions ticket — he pinged you in #backend. Three bugs came in overnight; one is assigned to you. Your one thing today: finish the design doc — Sara\'s launch is Thursday.',
  },
  pm: {
    role: 'Product Lead',
    icon: UserCheckIcon,
    date: 'Monday, July 27',
    body: 'The team closed 8 tickets over the weekend, including the payment retry fix. Alex opened a proposal for offline caching in #product. No urgent customer escalations today. Your one thing: sign off on the Q3 roadmap before 2 PM sync.',
  },
  quiet: {
    role: 'Quiet Friday',
    icon: CoffeeIcon,
    date: 'Friday, July 24',
    body: 'Quiet day yesterday — no critical outages and all sprint items are on track. A good chance to focus on Sarah\'s onboarding doc and clear your backlog.',
  },
} as const

type BriefKey = keyof typeof SAMPLE_BRIEFS

export function LandingPage() {
  const reduce = useReducedMotion()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500/30 selection:text-teal-200 antialiased relative overflow-x-hidden">
      {/* Ambient Grid Mesh Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(20,184,166,0.15),rgba(255,255,255,0))] pointer-events-none" />

      <LandingNav />
      <Hero reduce={reduce} />
      <BriefPreview reduce={reduce} />
      <Explanation reduce={reduce} />
      <Footer />
    </div>
  )
}

function LandingNav() {
  return (
    <nav className="sticky top-0 z-40 backdrop-blur-md bg-slate-950/80 border-b border-white/10 px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-sm tracking-tight group active:scale-[0.98] transition-transform duration-150">
          <span className="w-5 h-5 bg-teal-500 text-black flex items-center justify-center font-mono text-xs font-bold rounded-none group-hover:bg-teal-400 transition-colors shadow-xs">
            D
          </span>
          <span className="font-semibold tracking-tight text-white font-sans">Doko</span>
        </Link>

        <Link
          href="/sign-in"
          className="text-xs font-mono font-medium uppercase tracking-wider px-4 py-2 border border-teal-500/40 text-teal-400 hover:bg-teal-500/10 active:scale-[0.97] transition-all duration-150 ease-out shadow-xs"
        >
          Sign in
        </Link>
      </div>
    </nav>
  )
}

function Hero({ reduce }: { reduce: boolean | null }) {
  return (
    <motion.section
      initial={reduce ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="max-w-3xl mx-auto px-6 pt-24 pb-14 text-center relative z-10"
    >
      <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-teal-400 font-mono font-semibold mb-6 bg-teal-500/10 px-3.5 py-1.5 border border-teal-500/25 backdrop-blur-xs">
        <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
        <SparklesIcon className="w-3.5 h-3.5" />
        For teams that stopped reading Slack every morning
      </div>

      <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight leading-[1.12] text-white mb-6">
        The <span className="text-teal-400">4-sentence morning brief</span> for your team.
      </h1>

      <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10 font-light">
        Doko reads what your team did yesterday and hands you the news at 8:00 AM. No noisy dashboards. No Slack scrolling. Just the answer.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider bg-teal-500 text-black px-6 py-3.5 hover:bg-teal-400 active:scale-[0.97] transition-all duration-150 ease-out shadow-xl"
        >
          Sign in with Google <ArrowRightIcon className="w-4 h-4" />
        </Link>

        <a
          href="#sample"
          className="text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-white transition-colors py-3.5 px-3 active:scale-[0.98]"
        >
          See interactive brief ↓
        </a>
      </div>
    </motion.section>
  )
}

function BriefPreview({ reduce }: { reduce: boolean | null }) {
  const [selectedKey, setSelectedKey] = useState<BriefKey>('dev')
  const [copied, setCopied] = useState(false)

  const activeBrief = SAMPLE_BRIEFS[selectedKey]

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeBrief.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.section
      id="sample"
      initial={reduce ? {} : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="max-w-4xl mx-auto px-6 py-12 relative z-10"
    >
      {/* Interactive Role Selector */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <span>Select Role View:</span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 border border-white/10">
          {(Object.keys(SAMPLE_BRIEFS) as BriefKey[]).map(key => {
            const item = SAMPLE_BRIEFS[key]
            const Icon = item.icon
            const active = key === selectedKey

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                className={`px-3 py-1.5 text-xs font-mono transition-all duration-150 ease-out flex items-center gap-1.5 active:scale-[0.97] cursor-pointer ${
                  active
                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.role}
              </button>
            )
          })}
        </div>
      </div>

      {/* Brief Card Frame */}
      <div className="relative border border-teal-500/35 bg-slate-900/90 p-8 sm:p-10 shadow-2xl backdrop-blur-md overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4 flex-wrap gap-2">
          <div className="text-xs uppercase tracking-widest text-teal-400 font-mono font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <SparklesIcon className="w-3.5 h-3.5" />
            Morning Brief · <span className="tabular-nums">{activeBrief.date}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider bg-white/5 px-2 py-0.5 border border-white/10">
              Google Gemini 3.5 AI
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-slate-400 hover:text-teal-400 p-1 transition-colors active:scale-[0.95]"
              title="Copy brief text"
            >
              {copied ? <CheckIcon className="w-4 h-4 text-teal-400" /> : <CopyIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <p className="text-xl sm:text-2xl font-light leading-relaxed text-slate-100 whitespace-pre-wrap transition-opacity duration-150">
          {activeBrief.body}
        </p>
      </div>
    </motion.section>
  )
}

function Explanation({ reduce }: { reduce: boolean | null }) {
  const strips = [
    {
      icon: ShieldCheckIcon,
      heading: 'It knows what happened',
      body: 'Doko reads every ticket move, every comment, and every chat message. It does not summarize fluff — it selects. The 2-3 things that actually mattered yesterday show up. Everything else stays out of your way.',
    },
    {
      icon: ZapIcon,
      heading: 'It knows what needs you',
      body: 'The brief is different for every person on the team. Marco\'s brief is about Marco\'s tickets and threads. Yours is about yours. Not a generic team digest — your morning priority.',
    },
    {
      icon: BellOffIcon,
      heading: 'It knows when to shut up',
      body: 'Quiet Friday? The brief is one honest sentence: "Quiet day yesterday — a good chance to focus on Sarah\'s onboarding doc." No manufactured urgency. No corporate filler.',
    },
  ]

  return (
    <section className="max-w-3xl mx-auto px-6 py-20 space-y-16 relative z-10">
      {strips.map((s, idx) => {
        const Icon = s.icon
        return (
          <motion.div
            key={s.heading}
            initial={reduce ? {} : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.2, delay: idx * 0.05, ease: [0.23, 1, 0.32, 1] }}
            className="border-l-2 border-teal-500/40 pl-6 py-1 hover:border-teal-400 transition-colors"
          >
            <div className="flex items-center gap-2 text-teal-400 font-mono text-xs uppercase tracking-widest mb-2 font-semibold">
              <Icon className="w-4 h-4" />
              {s.heading}
            </div>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-light">
              {s.body}
            </p>
          </motion.div>
        )
      })}
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/10 py-10 bg-slate-950 relative z-10">
      <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
        <div>Doko · The Morning Brief App</div>
        <div>
          Built by <span className="text-slate-300">Malish Stha</span>
        </div>
      </div>
    </footer>
  )
}
