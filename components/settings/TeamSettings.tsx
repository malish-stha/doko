'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useSession } from 'next-auth/react'
import { api } from '@/convex/_generated/api'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  UsersIcon,
  MailIcon,
  ShieldIcon,
  UserXIcon,
  LogOutIcon,
  SendIcon,
  Loader2Icon,
  PlusIcon,
  EditIcon,
  CheckIcon,
  XIcon,
  Trash2Icon,
} from 'lucide-react'

export function TeamSettings() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined
  const router = useRouter()
  const team = useQuery(api.teams.myTeam, userEmail ? { userEmail } : 'skip')
  const members = useQuery(api.teamMembers.listForTeam) ?? []
  const invites = useQuery(api.invites.listForTeam) ?? []

  const [inviteEmail, setInviteEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDomain, setNewTeamDomain] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)

  // Edit Team State
  const [editingTeam, setEditingTeam] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDomain, setEditDomain] = useState('')
  const [savingTeam, setSavingTeam] = useState(false)

  const sendInvite = useMutation(api.invites.send)
  const revokeInvite = useMutation(api.invites.revoke)
  const removeMember = useMutation(api.teamMembers.remove)
  const leaveTeam = useMutation(api.teamMembers.leave)
  const deleteTeam = useMutation(api.teams.deleteTeam)
  const changeRole = useMutation(api.teamMembers.changeRole)
  const createTeam = useMutation(api.teams.create)
  const updateTeam = useMutation(api.teams.update)

  useEffect(() => {
    if (team) {
      setEditName(team.name)
      setEditDomain(team.workspaceDomain ?? '')
    }
  }, [team])

  if (team === undefined) return <div className="p-8 animate-pulse font-mono text-xs">Loading team settings…</div>
  if (!team) return <div className="p-8 text-xs font-mono text-muted-foreground">No active team found.</div>

  const currentEmail = (session?.user?.email ?? '').trim().toLowerCase()
  const me = members.find(m => m.email.trim().toLowerCase() === currentEmail)
  const isOwner = me?.role === 'owner' || members.length <= 1

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || sending) return
    setSending(true)
    setErrorMsg('')
    try {
      await sendInvite({ email: inviteEmail.trim() })
      setInviteEmail('')
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Failed to send invite')
    } finally {
      setSending(false)
    }
  }

  const handleCreateNewTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTeamName.trim() || creatingTeam) return
    setCreatingTeam(true)
    try {
      await createTeam({
        name: newTeamName.trim(),
        workspaceDomain: newTeamDomain.trim() || undefined,
        userEmail: session?.user?.email ?? undefined,
        userName: session?.user?.name ?? undefined,
      })
      setNewTeamName('')
      setNewTeamDomain('')
      setShowCreateModal(false)
    } catch (err: any) {
      console.error(err)
    } finally {
      setCreatingTeam(false)
    }
  }

  const handleSaveTeamSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim() || savingTeam) return
    setSavingTeam(true)
    try {
      await updateTeam({
        name: editName.trim(),
        workspaceDomain: editDomain.trim() || '',
      })
      setEditingTeam(false)
    } catch (err: any) {
      console.error(err)
    } finally {
      setSavingTeam(false)
    }
  }

  const handleLeaveOrDelete = async () => {
    try {
      if (isOwner) {
        if (confirm('Are you sure you want to delete this team workspace? All members, channels, and data will be removed.')) {
          await deleteTeam()
          router.replace('/onboarding')
        }
      } else {
        await leaveTeam()
        router.replace('/onboarding')
      }
    } catch (err: any) {
      console.error(err)
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      {/* Header Banner */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/10 pb-6">
        <div>
          {editingTeam ? (
            <form onSubmit={handleSaveTeamSettings} className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Team Name"
                  className="bg-slate-950 border-white/10 font-semibold"
                />
                <Input
                  value={editDomain}
                  onChange={e => setEditDomain(e.target.value)}
                  placeholder="Domain (leave blank to allow all emails)"
                  className="bg-slate-950 border-white/10 text-xs font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={savingTeam}
                  size="sm"
                  className="bg-teal-500 hover:bg-teal-400 text-black text-xs font-mono uppercase"
                >
                  {savingTeam ? <Loader2Icon className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckIcon className="w-3.5 h-3.5 mr-1" />}
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTeam(false)}
                  className="text-xs font-mono uppercase border-white/10"
                >
                  <XIcon className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{team.name} Settings</h1>
                <button
                  type="button"
                  onClick={() => setEditingTeam(true)}
                  className="text-slate-400 hover:text-teal-400 p-1 transition-colors"
                  title="Edit team name or domain restriction"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                Workspace Domain:{' '}
                {team.workspaceDomain ? (
                  <span className="text-teal-400 font-semibold">@{team.workspaceDomain}</span>
                ) : (
                  <span className="text-slate-400">Open (no domain restriction — any email allowed)</span>
                )}
              </p>
            </div>
          )}
        </div>

        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-teal-500 text-black hover:bg-teal-400 active:scale-[0.97] transition-all duration-150 ease-out shadow-md"
        >
          <PlusIcon className="w-4 h-4" />
          Create New Team
        </Link>
      </div>

      {/* Quick Create Team Box if toggled */}
      {showCreateModal && (
        <Card className="border border-teal-500/50 bg-slate-900/90 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-teal-400 flex items-center gap-2">
              <PlusIcon className="w-4 h-4" />
              Create A New Team Workspace
            </CardTitle>
            <CardDescription className="text-xs">
              You will become the owner of the new team. You can switch or invite members after creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateNewTeam} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-team-name" className="text-xs font-medium">Team Name</Label>
                <Input
                  id="new-team-name"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  placeholder="e.g. Acme Mobile Engineering"
                  className="bg-slate-950 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-team-domain" className="text-xs font-medium">
                  Workspace Domain <span className="text-muted-foreground font-normal">(optional — e.g. acme.com)</span>
                </Label>
                <Input
                  id="new-team-domain"
                  value={newTeamDomain}
                  onChange={e => setNewTeamDomain(e.target.value)}
                  placeholder="acme.com"
                  className="bg-slate-950 border-white/10 text-xs font-mono"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs font-mono uppercase border-white/10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!newTeamName.trim() || creatingTeam}
                  className="bg-teal-500 hover:bg-teal-400 text-black font-semibold text-xs uppercase tracking-wider active:scale-[0.97]"
                >
                  {creatingTeam ? <Loader2Icon className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Create Team
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Invite Member Section */}
      <Card className="border border-teal-500/30 bg-slate-900/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-sm font-mono uppercase tracking-wider text-teal-400 flex items-center gap-2">
            <MailIcon className="w-4 h-4" />
            Invite Teammate by Email
          </CardTitle>
          <CardDescription className="text-xs">
            {team.workspaceDomain ? (
              <span>
                Team domain restriction is active. Invites are restricted to{' '}
                <strong className="text-teal-400">@{team.workspaceDomain}</strong> emails. (Click edit icon above to clear domain restriction).
              </span>
            ) : (
              'Send an email invitation link to join your Doko workspace team.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendInvite} className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs font-medium">
                Teammate's Email
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder={team.workspaceDomain ? `colleague@${team.workspaceDomain}` : 'colleague@example.com'}
                className="bg-slate-950 border-white/10 text-xs font-mono"
              />
            </div>
            <Button
              type="submit"
              disabled={!inviteEmail.trim() || sending}
              className="bg-teal-500 hover:bg-teal-400 text-black font-semibold text-xs uppercase tracking-wider active:scale-[0.97] transition-all duration-150 ease-out cursor-pointer"
            >
              {sending ? (
                <>
                  <Loader2Icon className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Sending…
                </>
              ) : (
                <>
                  <SendIcon className="w-3.5 h-3.5 mr-1.5" />
                  Send Invite
                </>
              )}
            </Button>
          </form>
          {errorMsg && <p className="text-xs font-mono text-red-400 mt-2">{errorMsg}</p>}
        </CardContent>
      </Card>

      {/* Team Members List */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-sm font-mono uppercase tracking-wider text-foreground flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-teal-400" />
            Team Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map(member => (
            <div
              key={member._id}
              className="flex items-center justify-between p-3 border border-white/10 bg-slate-950/60"
            >
              <div>
                <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                  {member.email}
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 border border-teal-500/30 text-teal-400 bg-teal-500/10 font-semibold">
                    {member.role}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  Joined: {new Date(member.joinedAt).toLocaleDateString()}
                </div>
              </div>

              {member.role !== 'owner' && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      changeRole({
                        memberId: member._id,
                        role: member.role === 'admin' ? 'member' : 'admin',
                      })
                    }
                    className="text-[10px] font-mono uppercase border-white/10 active:scale-[0.97]"
                  >
                    <ShieldIcon className="w-3 h-3 mr-1" />
                    {member.role === 'admin' ? 'Demote' : 'Promote'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeMember({ memberId: member._id })}
                    className="text-[10px] font-mono uppercase active:scale-[0.97]"
                  >
                    <UserXIcon className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pending Invites List */}
      {invites.length > 0 && (
        <Card className="border border-border/80 bg-card/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-foreground">
              Pending Invites ({invites.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invites.map(inv => (
              <div
                key={inv._id}
                className="flex items-center justify-between p-3 border border-white/10 bg-slate-950/60"
              >
                <div>
                  <div className="font-mono text-xs font-semibold text-foreground">{inv.email}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    Status: {inv.status} · Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                {inv.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => revokeInvite({ inviteId: inv._id })}
                    className="text-[10px] font-mono uppercase text-red-400 border-red-500/20 hover:bg-red-500/10 active:scale-[0.97]"
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Leave or Delete Team Option */}
      <div className="pt-4 border-t border-white/10 flex justify-end">
        <Button
          variant="outline"
          onClick={handleLeaveOrDelete}
          className="text-xs font-mono uppercase border-red-500/30 text-red-400 hover:bg-red-500/10 active:scale-[0.97]"
        >
          {isOwner ? (
            <>
              <Trash2Icon className="w-3.5 h-3.5 mr-1.5" />
              Delete Team Workspace
            </>
          ) : (
            <>
              <LogOutIcon className="w-3.5 h-3.5 mr-1.5" />
              Leave Team
            </>
          )}
        </Button>
      </div>
    </main>
  )
}
