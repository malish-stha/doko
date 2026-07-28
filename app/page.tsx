import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/landing/LandingPage'

export const metadata: Metadata = {
  title: 'Doko — The 4-sentence morning brief for your team',
  description:
    'Doko reads what your team did yesterday and hands you the news at 8:00 AM. No dashboards. No Slack scrolling. Just the answer.',
  openGraph: {
    title: 'Doko — The morning brief for your team',
    description: 'The 4-sentence morning brief for your team.',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Doko',
    description: 'The 4-sentence morning brief for your team.',
  },
}

export default async function RootPage() {
  const session = await auth()
  if (session) {
    redirect('/home')
  }
  return <LandingPage />
}
