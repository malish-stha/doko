'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { signIn } from 'next-auth/react'
import {
  SparklesIcon,
  ArrowLeftIcon,
  Loader2Icon,
  MoonIcon,
  CpuIcon,
  SunIcon,
  CheckCircle2Icon,
} from 'lucide-react'
import { Footer } from '@/components/Footer'

const PIPELINE_STEPS = [
  {
    id: 'ingest',
    number: '01',
    title: 'Overnight Ingest',
    icon: MoonIcon,
    tag: '11:00 PM – 7:00 AM',
    headline: 'Compiles activity while your team sleeps',
    desc: 'Doko passively gathers ticket status changes, PR comments, and channel updates overnight without disturbing anyone.',
    badge: '14 Events Captured',
  },
  {
    id: 'filter',
    number: '02',
    title: 'AI Signal Extraction',
    icon: CpuIcon,
    tag: '7:55 AM Engine',
    headline: 'Strips 90% of daily communication noise',
    desc: 'Gemini filters out routine chat fluff and pinpoints only blocked tasks, overnight tickets, and your top priority for the day.',
    badge: '4 Sentences Distilled',
  },
  {
    id: 'deliver',
    number: '03',
    title: '8:00 AM Delivery',
    icon: SunIcon,
    tag: '8:00 AM Sharp',
    headline: 'Your personalized brief is ready at your desk',
    desc: 'You open Doko and instantly see what happened yesterday and what needs your attention today. Zero scrolling required.',
    badge: 'Ready on Sign In',
  },
] as const

const EASE_OUT = [0.23, 1, 0.32, 1] as const

interface SignInClientProps {
  onSignInAction?: () => Promise<void>
}

export function SignInClient({ onSignInAction }: SignInClientProps) {
  const reduce = useReducedMotion()
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const activeStep = PIPELINE_STEPS[activeStepIndex]

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (onSignInAction) {
        await onSignInAction()
      } else {
        await signIn('google', { callbackUrl: '/board' })
      }
    } catch {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500/30 selection:text-teal-200 antialiased flex flex-col justify-between relative overflow-hidden">
      {/* Ambient Radial Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_-10%,rgba(20,184,166,0.18),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-[450px] h-[450px] bg-teal-500/10 blur-[150px] pointer-events-none rounded-full" />
      <div className="absolute -top-24 -right-24 w-[450px] h-[450px] bg-cyan-500/10 blur-[150px] pointer-events-none rounded-full" />

      {/* Navigation Header */}
      <header className="px-6 py-6 max-w-6xl mx-auto w-full flex items-center justify-between relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-white transition-colors group active:scale-[0.97]"
        >
          <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-150 ease-out" />
          Back to home
        </Link>

        <div className="flex items-center gap-2 font-bold text-sm tracking-tight">
          <span className="w-6 h-6 bg-teal-500 text-slate-950 flex items-center justify-center font-mono text-xs font-black rounded-md shadow-xs">
            D
          </span>
          <span className="font-semibold tracking-tight text-white text-base">Doko</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10 my-auto">
        {/* Left Column: Interactive 3-Step Morning Engine Visualizer */}
        <motion.div
          initial={reduce ? {} : { opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="lg:col-span-7 space-y-6"
        >
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-teal-300 font-mono font-semibold bg-teal-500/10 px-3.5 py-1.5 rounded-full border border-teal-500/20 backdrop-blur-md">
            <SparklesIcon className="w-3.5 h-3.5" />
            How Doko Works Overnight
          </div>

          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight leading-tight text-white">
            From overnight noise to your <span className="text-teal-400 font-semibold underline decoration-teal-500/40 underline-offset-8">8:00 AM answer</span>.
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed font-light">
            Click through the 3 steps below to see how Doko compiles your team's updates before you log in.
          </p>

          {/* Interactive Step Selection Pills */}
          <div className="grid grid-cols-3 gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-white/10">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon
              const active = idx === activeStepIndex

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStepIndex(idx)}
                  className={`relative p-2.5 text-xs font-mono transition-colors duration-150 flex flex-col items-start gap-1 rounded-lg cursor-pointer text-left ${
                    active ? 'text-teal-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="activePipelineStep"
                      className="absolute inset-0 bg-teal-500/20 border border-teal-500/40 rounded-lg shadow-xs"
                      transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
                    />
                  )}
                  <div className="flex items-center justify-between w-full relative z-10">
                    <span className="text-[10px] text-slate-500 font-bold">{step.number}</span>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate w-full relative z-10">{step.title}</span>
                </button>
              )
            })}
          </div>

          {/* Dynamic Step Detail Card */}
          <div className="relative border border-teal-500/30 bg-slate-900/80 p-6 sm:p-8 rounded-2xl shadow-xl backdrop-blur-xl ring-1 ring-white/10 overflow-hidden min-h-[190px]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-widest text-teal-400 font-mono font-semibold flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400" />
                </span>
                {activeStep.tag}
              </span>
              <span className="text-[10px] font-mono text-slate-300 uppercase tracking-wider bg-teal-500/20 px-2.5 py-1 rounded-md border border-teal-500/30 font-medium flex items-center gap-1">
                <CheckCircle2Icon className="w-3 h-3 text-teal-400" />
                {activeStep.badge}
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep.id}
                initial={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -4, filter: 'blur(2px)' }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
                className="space-y-2"
              >
                <h3 className="text-lg sm:text-xl font-medium text-white">
                  {activeStep.headline}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  {activeStep.desc}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Right Column: Clean Sign In Card */}
        <motion.div
          initial={reduce ? {} : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="lg:col-span-5 flex justify-center"
        >
          <div className="w-full max-w-md border border-white/10 bg-slate-900/90 p-8 sm:p-10 rounded-2xl shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-teal-500/15 blur-2xl pointer-events-none rounded-full" />

            {/* Title & Header */}
            <div className="text-center mb-8 space-y-2">
              <div className="inline-flex w-12 h-12 bg-teal-500/10 border border-teal-500/30 rounded-xl items-center justify-center text-teal-400 font-mono font-bold text-xl mb-2 shadow-inner">
                D
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Sign in to Doko</h2>
              <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Workspace & Team Single Sign-On
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSignIn} className="space-y-4">
              <motion.button
                type="submit"
                disabled={isLoading}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.15, ease: EASE_OUT }}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-slate-950 font-semibold text-sm rounded-xl hover:bg-slate-100 active:scale-[0.97] transition-all duration-150 ease-out shadow-lg shadow-white/5 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2Icon className="w-4 h-4 animate-spin text-teal-600" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon className="w-4 h-4" />
                    <span>Continue with Google</span>
                  </>
                )}
              </motion.button>
            </form>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  )
}
