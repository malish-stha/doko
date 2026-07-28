'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SparklesIcon, UsersIcon, CheckIcon, Loader2Icon, PlusIcon } from 'lucide-react'

export function OnboardingClient() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const team = useQuery(api.teams.myTeam, userEmail ? { userEmail } : 'skip')
  const invites = useQuery(api.invites.pendingForMe, userEmail ? { userEmail } : 'skip') ?? []
  const router = useRouter()

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')

  const createTeam = useMutation(api.teams.create)
  const acceptInvite = useMutation(api.invites.accept)

  const handleCreate = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    try {
      await createTeam({
        name,
        workspaceDomain: domain || undefined,
        userEmail: session?.user?.email ?? undefined,
        userName: session?.user?.name ?? undefined,
      })
      router.replace('/home')
    } catch (err) {
      console.error('Failed to create team:', err)
      setCreating(false)
    }
  }

  return (
    <main className="max-w-md mx-auto px-6 py-16 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-teal-400 font-semibold mb-2">
          <SparklesIcon className="w-4 h-4" />
          Welcome to Doko
        </div>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">Set up your team</h1>
        <p className="text-sm text-muted-foreground mt-1 font-light">
          {team ? `Current active team: ${team.name}. Create a new team workspace or accept pending invites below.` : 'Create a new team workspace or accept an invite to get started.'}
        </p>
      </div>

      {invites.length > 0 && (
        <Card className="border border-teal-500/40 bg-slate-900/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-teal-400 flex items-center gap-2">
              <UsersIcon className="w-4 h-4" />
              Pending Invites
            </CardTitle>
            <CardDescription className="text-xs">
              You were invited to join an existing Doko team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invites.map(inv => (
              <div key={inv._id} className="flex items-center justify-between p-3 border border-white/10 bg-slate-950/60">
                <div>
                  <div className="font-semibold text-sm text-foreground">{inv.teamName}</div>
                  <div className="text-xs font-mono text-muted-foreground">from {inv.invitedByEmail}</div>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    await acceptInvite({
                      inviteId: inv._id,
                      userEmail: session?.user?.email ?? undefined,
                      userName: session?.user?.name ?? undefined,
                    })
                    router.replace('/home')
                  }}
                  className="bg-teal-500 hover:bg-teal-400 text-black font-semibold text-xs uppercase tracking-wider active:scale-[0.97] transition-all duration-150 ease-out cursor-pointer"
                >
                  <CheckIcon className="w-3.5 h-3.5 mr-1" />
                  Accept
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border border-border/80 bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <PlusIcon className="w-4 h-4 text-teal-400" />
            Create a new team
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            You will be the team owner. You can invite your teammates after.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="team-name" className="text-xs font-medium">
              Team name
            </Label>
            <Input
              id="team-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Acme Product Team"
              className="bg-slate-950 border-white/10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team-domain" className="text-xs font-medium">
              Workspace domain <span className="text-muted-foreground font-normal">(optional — e.g. acme.com)</span>
            </Label>
            <Input
              id="team-domain"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="acme.com"
              className="bg-slate-950 border-white/10 font-mono text-xs"
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="w-full bg-teal-500 hover:bg-teal-400 text-black font-semibold text-xs uppercase tracking-wider active:scale-[0.97] transition-all duration-150 ease-out cursor-pointer"
          >
            {creating ? (
              <>
                <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                Creating Team…
              </>
            ) : (
              'Create Team'
            )}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
