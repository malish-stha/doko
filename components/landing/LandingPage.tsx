'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
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
import { Footer } from '@/components/Footer'

const SAMPLE_BRIEFS = {
  dev: {
    role: 'Software Engineer',
    icon: CodeIcon,
    date: 'Monday, July 27',
    body: 'Priya shipped the auth refactor yesterday. Marco is still blocked on the S3 permissions ticket - he pinged you in #backend. Three bugs came in overnight; one is assigned to you. Your one thing today: finish the design doc - Sara\'s launch is Thursday.',
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
    body: 'Quiet day yesterday - no critical outages and all sprint items are on track. A good chance to focus on Sarah\'s onboarding doc and clear your backlog.',
  },
} as const

type BriefKey = keyof typeof SAMPLE_BRIEFS

const EASE_OUT = [0.23, 1, 0.32, 1] as const

export function LandingPage() {
  const reduce = useReducedMotion()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500/30 selection:text-teal-200 antialiased relative overflow-x-hidden">
      {/* Ambient Radial Mesh Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,rgba(20,184,166,0.18),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-teal-500/5 blur-[120px] pointer-events-none rounded-full" />

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
    <nav className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/75 border-b border-white/10 px-6 py-4 transition-colors">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold text-sm tracking-tight group active:scale-[0.97] transition-transform duration-150 ease-out"
        >
          <span className="w-6 h-6 bg-teal-500 text-slate-950 flex items-center justify-center font-mono text-xs font-black rounded-md group-hover:bg-teal-400 transition-colors shadow-xs">
            D
          </span>
          <span className="font-semibold tracking-tight text-white text-base">Doko</span>
        </Link>

        <Link
          href="/sign-in"
          className="text-xs font-mono font-medium uppercase tracking-wider px-4 py-2 rounded-lg border border-teal-500/30 text-teal-300 hover:bg-teal-500/10 hover:border-teal-500/50 active:scale-[0.97] transition-all duration-150 ease-out shadow-xs"
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
      initial={reduce ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="max-w-3xl mx-auto px-6 pt-20 pb-14 text-center relative z-10"
    >
      <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-teal-300 font-mono font-semibold mb-6 bg-teal-500/10 px-4 py-1.5 rounded-full border border-teal-500/20 backdrop-blur-md shadow-xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400" />
        </span>
        <SparklesIcon className="w-3.5 h-3.5" />
        For teams that stopped reading Slack every morning
      </div>

      <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight leading-[1.12] text-white mb-6">
        The <span className="text-teal-400 font-semibold underline decoration-teal-500/40 underline-offset-8">4-sentence morning brief</span> for your team.
      </h1>

      <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10 font-light">
        Doko reads what your team did yesterday and hands you the news at 8:00 AM. No noisy dashboards. No Slack scrolling. Just the answer.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <motion.div whileTap={{ scale: 0.97 }} transition={{ duration: 0.15, ease: EASE_OUT }}>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider bg-teal-400 text-slate-950 px-6 py-3.5 rounded-xl hover:bg-teal-300 transition-all duration-150 ease-out shadow-lg shadow-teal-500/20 active:scale-[0.97]"
          >
            Sign in <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </motion.div>

        <a
          href="#sample"
          className="text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-white transition-colors py-3.5 px-4 rounded-xl hover:bg-white/5 active:scale-[0.98] duration-150"
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
      initial={reduce ? {} : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="max-w-4xl mx-auto px-6 py-10 relative z-10"
    >
      {/* Interactive Role Selector with Fluid Shared Layout Animation */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <span>Select Role View:</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-white/10 shadow-inner">
          {(Object.keys(SAMPLE_BRIEFS) as BriefKey[]).map(key => {
            const item = SAMPLE_BRIEFS[key]
            const Icon = item.icon
            const active = key === selectedKey

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                className={`relative px-3.5 py-1.5 text-xs font-mono transition-colors duration-150 flex items-center gap-2 rounded-lg cursor-pointer ${active ? 'text-teal-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {active && (
                  <motion.div
                    layoutId="activeRoleTab"
                    className="absolute inset-0 bg-teal-500/20 border border-teal-500/40 rounded-lg shadow-xs"
                    transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{item.role}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Brief Card Frame with Subtle Glass Glow */}
      <div className="relative border border-teal-500/30 bg-slate-900/90 p-8 sm:p-10 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden ring-1 ring-white/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4 flex-wrap gap-2">
          <div className="text-xs uppercase tracking-widest text-teal-400 font-mono font-semibold flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400" />
            </span>
            <SparklesIcon className="w-3.5 h-3.5" />
            Morning Brief · <span className="tabular-nums font-mono">{activeBrief.date}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
              Google Gemini 3.5 AI
            </span> */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={handleCopy}
              className="text-slate-400 hover:text-teal-300 p-1.5 rounded-md hover:bg-white/5 transition-colors active:scale-95"
              title="Copy brief text"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="check"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.12 }}
                  >
                    <CheckIcon className="w-4 h-4 text-teal-400" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.12 }}
                  >
                    <CopyIcon className="w-4 h-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* AnimatePresence for smooth brief content switching */}
        <AnimatePresence mode="wait">
          <motion.p
            key={selectedKey}
            initial={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -4, filter: 'blur(2px)' }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="text-xl sm:text-2xl font-light leading-relaxed text-slate-100 whitespace-pre-wrap"
          >
            {activeBrief.body}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.section>
  )
}

function Explanation({ reduce }: { reduce: boolean | null }) {
  const strips = [
    {
      icon: ShieldCheckIcon,
      heading: 'It knows what happened',
      body: 'Doko reads every ticket move, every comment, and every chat message. It does not summarize fluff - it selects. The 2-3 things that actually mattered yesterday show up. Everything else stays out of your way.',
    },
    {
      icon: ZapIcon,
      heading: 'It knows what needs you',
      body: 'The brief is different for every person on the team. Marco\'s brief is about Marco\'s tickets and threads. Yours is about yours. Not a generic team digest - your morning priority.',
    },
    {
      icon: BellOffIcon,
      heading: 'It knows when to shut up',
      body: 'Quiet Friday? The brief is one honest sentence: "Quiet day yesterday - a good chance to focus on Sarah\'s onboarding doc." No manufactured urgency. No corporate filler.',
    },
  ]

  return (
    <section className="max-w-3xl mx-auto px-6 py-16 space-y-12 relative z-10">
      {strips.map((s, idx) => {
        const Icon = s.icon
        return (
          <motion.div
            key={s.heading}
            initial={reduce ? {} : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.2, delay: idx * 0.05, ease: EASE_OUT }}
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
