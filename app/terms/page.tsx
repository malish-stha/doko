import Link from 'next/link'
import { ArrowLeftIcon, FileTextIcon } from 'lucide-react'
import { Footer } from '@/components/Footer'

export const metadata = {
  title: 'Terms of Service - Doko',
  description: 'Terms and conditions for using Doko.',
}

export default function TermsPage() {
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
            <FileTextIcon className="w-4 h-4" />
            Terms & Agreement
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Terms of Service
          </h1>

          <p className="text-sm font-mono text-slate-400">
            Last updated: July 28, 2026
          </p>

          <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-6 pt-4 font-light">
            <section className="space-y-2 border-b border-white/10 pb-6">
              <h2 className="text-lg font-semibold text-white font-mono uppercase tracking-wider">
                1. Acceptance of Terms
              </h2>
              <p>
                By signing in to Doko or creating a workspace, you agree to these Terms of Service. If you are using Doko on behalf of an organization, you represent that you have authority to bind that organization.
              </p>
            </section>

            <section className="space-y-2 border-b border-white/10 pb-6">
              <h2 className="text-lg font-semibold text-white font-mono uppercase tracking-wider">
                2. Acceptable Use
              </h2>
              <p>
                You are responsible for all content posted in tickets and chat. You agree not to upload malicious code, engage in spam, or attempt unauthorized access to other team workspaces.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white font-mono uppercase tracking-wider">
                3. Service Availability
              </h2>
              <p>
                Doko aims for high availability of real-time ticket updates and 8:00 AM brief delivery. We reserve the right to perform scheduled maintenance or update features to improve performance.
              </p>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
