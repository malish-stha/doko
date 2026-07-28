'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EditProfileModal } from './EditProfileModal'
import { DiceBearAvatarPicker } from './DiceBearAvatarPicker'
import { UserAvatar } from '@/components/UserAvatar'
import { SparklesIcon } from 'lucide-react'

export function UserProfileSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      {/* Banner & Avatar Skeleton */}
      <div className="relative rounded-none overflow-hidden border border-border/40 bg-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <Skeleton className="w-24 h-24 rounded-none flex-shrink-0" />
          <div className="space-y-3 flex-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="flex flex-wrap gap-3 pt-1">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-28" />
            </div>
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 rounded-none border border-border/40 bg-card space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>

      {/* Tabs & Content Skeleton */}
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-border/40 pb-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-36 w-full rounded-none" />
          <Skeleton className="h-36 w-full rounded-none" />
        </div>
      </div>
    </div>
  )
}
import { StartDMButton } from '@/components/chat/StartDMButton'
import {
  UserIcon,
  BriefcaseIcon,
  BuildingIcon,
  MapPinIcon,
  PhoneIcon,
  GlobeIcon,
  CalendarIcon,
  EditIcon,
  CheckCircle2Icon,
  ClockIcon,
  TicketIcon,
  MailIcon,
  ShieldIcon,
  ExternalLinkIcon,
  LayersIcon,
} from 'lucide-react'

interface UserProfileViewProps {
  targetUserId?: string
}

export function UserProfileView({ targetUserId }: UserProfileViewProps) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined

  const profile = useQuery(api.users.getProfile, {
    targetUserId,
    userEmail,
  })

  const ticketData = useQuery(
    api.tickets.getUserTickets,
    profile
      ? {
          targetUserId: profile.userId,
          targetEmail: profile.email,
        }
      : 'skip',
  )

  const [activeTab, setActiveTab] = useState<'ongoing' | 'completed' | 'info'>('ongoing')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)

  if (profile === undefined) {
    return <UserProfileSkeleton />
  }

  if (!profile) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center space-y-4">
        <UserIcon className="w-12 h-12 mx-auto text-muted-foreground/50" />
        <h2 className="text-xl font-bold tracking-tight text-foreground">User Profile Not Found</h2>
        <p className="text-xs font-mono text-muted-foreground">
          The requested profile could not be found or you do not have permission to view it.
        </p>
      </div>
    )
  }

  const initial = (profile.name || profile.email || 'U').slice(0, 1).toUpperCase()
  const ongoingTickets = ticketData?.ongoing ?? []
  const completedTickets = ticketData?.completed ?? []
  const totalTickets = ticketData?.total ?? 0

  const statusBadgeStyle: Record<string, string> = {
    backlog: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    todo: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    review: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    done: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
  }

  const priorityBadgeStyle: Record<string, string> = {
    low: 'text-slate-400 border-slate-500/30',
    medium: 'text-blue-400 border-blue-500/30',
    high: 'text-amber-400 border-amber-500/30',
    urgent: 'text-red-400 border-red-500/30 font-semibold',
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Profile Header Banner */}
      <div className="p-6 bg-card border border-border relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <UserAvatar
                user={profile}
                size="2xl"
                className="border-2 border-teal-500/50 shadow-xl"
              />
              {profile.isSelf && (
                <button
                  type="button"
                  onClick={() => setAvatarPickerOpen(true)}
                  className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] font-mono font-bold text-teal-300 transition-all cursor-pointer border border-teal-400/50 backdrop-blur-xs"
                  title="Customize DiceBear Avatar"
                >
                  <SparklesIcon className="w-5 h-5 mb-1 text-teal-400 animate-pulse" />
                  <span>Customize Avatar</span>
                </button>
              )}
            </div>

            {/* Main Info */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{profile.name}</h1>

                {/* Job Post / Title Badge */}
                {profile.jobTitle && (
                  <Badge className="bg-teal-500/15 text-teal-300 border-teal-500/40 font-mono text-[11px] uppercase tracking-wider px-2.5 py-0.5">
                    <BriefcaseIcon className="w-3 h-3 mr-1" />
                    {profile.jobTitle}
                  </Badge>
                )}

                {/* Team Role Badge */}
                {profile.teamInfo && (
                  <Badge variant="outline" className="text-[10px] font-mono uppercase border-border text-muted-foreground">
                    <ShieldIcon className="w-3 h-3 mr-1 text-teal-400" />
                    {profile.teamInfo.role} @ {profile.teamInfo.teamName}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <MailIcon className="w-3.5 h-3.5 text-teal-400/80" />
                  {profile.email}
                </span>

                {profile.department && (
                  <span className="flex items-center gap-1">
                    <BuildingIcon className="w-3.5 h-3.5 text-teal-400/80" />
                    {profile.department}
                  </span>
                )}

                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPinIcon className="w-3.5 h-3.5 text-teal-400/80" />
                    {profile.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            {!profile.isSelf && (
              <StartDMButton userId={profile.userId} label="Send Message" size="sm" variant="default" className="bg-teal-500 text-black hover:bg-teal-400" />
            )}

            {profile.isSelf && (
              <>
                <Button
                  onClick={() => setAvatarPickerOpen(true)}
                  size="sm"
                  variant="outline"
                  className="border-teal-500/40 text-teal-300 hover:bg-teal-500/10 font-semibold text-xs font-mono uppercase tracking-wider active:scale-[0.97]"
                >
                  <SparklesIcon className="w-3.5 h-3.5 mr-1.5 text-teal-400" />
                  Customize Avatar
                </Button>

                <Button
                  onClick={() => setEditModalOpen(true)}
                  size="sm"
                  className="bg-teal-500 hover:bg-teal-400 text-black font-semibold text-xs font-mono uppercase tracking-wider active:scale-[0.97]"
                >
                  <EditIcon className="w-3.5 h-3.5 mr-1.5" />
                  Edit Profile
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Ongoing Tickets</div>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{ongoingTickets.length}</div>
            </div>
            <ClockIcon className="w-7 h-7 text-amber-400/40" />
          </CardContent>
        </Card>

        <Card className="bg-card border-border backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Tickets Done</div>
              <div className="text-2xl font-bold font-mono text-teal-400 mt-1">{completedTickets.length}</div>
            </div>
            <CheckCircle2Icon className="w-7 h-7 text-teal-400/40" />
          </CardContent>
        </Card>

        <Card className="bg-card border-border backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Total Tickets</div>
              <div className="text-2xl font-bold font-mono text-foreground mt-1">{totalTickets}</div>
            </div>
            <TicketIcon className="w-7 h-7 text-muted-foreground/40" />
          </CardContent>
        </Card>

        <Card className="bg-card border-border backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Member Since</div>
              <div className="text-sm font-semibold font-mono text-foreground mt-1">
                {profile.teamInfo?.joinedAt
                  ? new Date(profile.teamInfo.joinedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                  : new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </div>
            </div>
            <CalendarIcon className="w-7 h-7 text-teal-400/40" />
          </CardContent>
        </Card>
      </div>

      {/* Main Profile Tabs */}
      <div className="space-y-4">
        <div className="flex border-b border-border gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('ongoing')}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-wider font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'ongoing'
                ? 'border-teal-400 text-teal-400 bg-teal-500/10'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClockIcon className="w-3.5 h-3.5" />
            Ongoing Tickets ({ongoingTickets.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-wider font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'completed'
                ? 'border-teal-400 text-teal-400 bg-teal-500/10'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2Icon className="w-3.5 h-3.5" />
            Tickets Done Before ({completedTickets.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-wider font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'info'
                ? 'border-teal-400 text-teal-400 bg-teal-500/10'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BriefcaseIcon className="w-3.5 h-3.5" />
            Office & Personal Info
          </button>
        </div>

        {/* Tab 1: Ongoing Tickets */}
        {activeTab === 'ongoing' && (
          <div className="space-y-3">
            {ongoingTickets.length === 0 ? (
              <Card className="bg-card border-border p-8 text-center">
                <TicketIcon className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <div className="text-xs font-mono text-muted-foreground">No ongoing tickets currently active.</div>
              </Card>
            ) : (
              ongoingTickets.map(ticket => (
                <div
                  key={ticket._id}
                  className="p-4 bg-card border border-border hover:border-teal-500/40 transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-teal-400">{ticket.key}</span>
                      <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-teal-300 transition-colors">
                        {ticket.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground flex-wrap">
                      <span className={`px-2 py-0.5 border text-[10px] uppercase font-semibold ${statusBadgeStyle[ticket.status]}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>

                      <span className={`px-1.5 py-0.5 border text-[10px] uppercase ${priorityBadgeStyle[ticket.priority]}`}>
                        {ticket.priority}
                      </span>

                      <span>Project: <strong className="text-foreground">{ticket.projectId}</strong></span>

                      <span>Updated {new Date(ticket.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <Link
                    href={`/tickets/${ticket.key}`}
                    className="p-2 border border-border hover:border-teal-400 hover:bg-teal-500/10 text-muted-foreground hover:text-teal-300 transition-all shrink-0"
                    title="View Ticket Details"
                  >
                    <ExternalLinkIcon className="w-4 h-4" />
                  </Link>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Tickets Done Before */}
        {activeTab === 'completed' && (
          <div className="space-y-3">
            {completedTickets.length === 0 ? (
              <Card className="bg-card border-border p-8 text-center">
                <CheckCircle2Icon className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <div className="text-xs font-mono text-muted-foreground">No completed ticket history found yet.</div>
              </Card>
            ) : (
              completedTickets.map(ticket => (
                <div
                  key={ticket._id}
                  className="p-4 bg-card border border-border hover:border-teal-500/40 transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-teal-400">{ticket.key}</span>
                      <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-teal-300 transition-colors">
                        {ticket.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground flex-wrap">
                      <span className="px-2 py-0.5 border text-[10px] uppercase font-semibold bg-teal-500/10 text-teal-400 border-teal-500/30">
                        DONE
                      </span>

                      <span className={`px-1.5 py-0.5 border text-[10px] uppercase ${priorityBadgeStyle[ticket.priority]}`}>
                        {ticket.priority}
                      </span>

                      <span>Project: <strong className="text-foreground">{ticket.projectId}</strong></span>

                      <span>Completed on {new Date(ticket.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <Link
                    href={`/tickets/${ticket.key}`}
                    className="p-2 border border-border hover:border-teal-400 hover:bg-teal-500/10 text-muted-foreground hover:text-teal-300 transition-all shrink-0"
                    title="View Ticket Details"
                  >
                    <ExternalLinkIcon className="w-4 h-4" />
                  </Link>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Office & Personal Information */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Office Job & Position */}
            <Card className="bg-card border-border backdrop-blur-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-teal-400 flex items-center gap-2">
                  <BriefcaseIcon className="w-4 h-4" />
                  Office Job & Team Position
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Office Job Title:</span>
                  <span className="font-semibold text-foreground">{profile.jobTitle || 'Not specified'}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Department:</span>
                  <span className="font-semibold text-foreground">{profile.department || 'General'}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Workspace Team:</span>
                  <span className="font-semibold text-teal-400">{profile.teamInfo?.teamName || 'Doko Team'}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Team Role:</span>
                  <span className="font-mono uppercase font-semibold text-foreground">{profile.teamInfo?.role || 'Member'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Office Location:</span>
                  <span className="font-semibold text-foreground">{profile.location || 'Remote / Not specified'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Contact & Personal Details */}
            <Card className="bg-card border-border backdrop-blur-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-teal-400 flex items-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  Contact & Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Email Address:</span>
                  <span className="font-mono text-foreground">{profile.email}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Phone / Ext:</span>
                  <span className="font-mono text-foreground">{profile.phone || 'Not provided'}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Timezone:</span>
                  <span className="font-mono text-foreground">{profile.timezone}</span>
                </div>
                <div className="space-y-1 pt-1">
                  <span className="text-muted-foreground block">Bio / Summary:</span>
                  <p className="text-foreground/80 italic">{profile.bio || 'No bio written yet.'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Social & Professional Links */}
            {(profile.githubUrl || profile.linkedinUrl) && (
              <Card className="bg-card border-border backdrop-blur-md md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs font-mono uppercase tracking-wider text-teal-400 flex items-center gap-2">
                    <GlobeIcon className="w-4 h-4" />
                    Social & Professional Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                  {profile.githubUrl && (
                    <a
                      href={profile.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 border border-border text-xs font-mono text-foreground hover:border-teal-400 hover:text-teal-300 transition-all"
                    >
                      <GlobeIcon className="w-4 h-4 text-teal-400" />
                      GitHub Profile
                    </a>
                  )}
                  {profile.linkedinUrl && (
                    <a
                      href={profile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 border border-border text-xs font-mono text-foreground hover:border-teal-400 hover:text-teal-300 transition-all"
                    >
                      <GlobeIcon className="w-4 h-4 text-teal-400" />
                      LinkedIn Profile
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Edit Profile & Avatar Modals */}
      {profile.isSelf && (
        <>
          <EditProfileModal
            user={profile}
            userEmail={userEmail}
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
          />
          <DiceBearAvatarPicker
            open={avatarPickerOpen}
            onOpenChange={setAvatarPickerOpen}
            currentAvatarUrl={profile.avatarUrl}
            userEmail={profile.email}
            userName={profile.name}
          />
        </>
      )}
    </main>
  )
}
