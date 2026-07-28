'use client'

import { useState, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { Loader2Icon, BriefcaseIcon, BuildingIcon, MapPinIcon, PhoneIcon, GlobeIcon, UserIcon } from 'lucide-react'

interface EditProfileModalProps {
  user: {
    name?: string
    timezone?: string
    jobTitle?: string
    department?: string
    bio?: string
    phone?: string
    location?: string
    githubUrl?: string
    linkedinUrl?: string
  } | null
  userEmail?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditProfileModal({ user, userEmail, open, onOpenChange }: EditProfileModalProps) {
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [timezone, setTimezone] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const updateProfile = useMutation(api.users.updateProfile)

  useEffect(() => {
    if (user) {
      setName(user.name ?? '')
      setJobTitle(user.jobTitle ?? '')
      setDepartment(user.department ?? '')
      setBio(user.bio ?? '')
      setPhone(user.phone ?? '')
      setLocation(user.location ?? '')
      setTimezone(user.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
      setGithubUrl(user.githubUrl ?? '')
      setLinkedinUrl(user.linkedinUrl ?? '')
    }
  }, [user, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    setErrorMsg('')
    try {
      await updateProfile({
        userEmail,
        name: name.trim(),
        jobTitle: jobTitle.trim() || undefined,
        department: department.trim() || undefined,
        bio: bio.trim() || undefined,
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
        timezone: timezone.trim() || undefined,
        githubUrl: githubUrl.trim() || undefined,
        linkedinUrl: linkedinUrl.trim() || undefined,
      })
      toast.success('Profile updated', 'Your profile details have been saved successfully.')
      onOpenChange(false)
    } catch (err: any) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Failed to update profile'
      setErrorMsg(msg)
      toast.error('Failed to update profile', msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-slate-900 border-teal-500/30 text-foreground backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-mono uppercase tracking-wider text-teal-400 flex items-center gap-2">
            <UserIcon className="w-4 h-4" />
            Edit Profile Information
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update your office job post details, location, contact information, and personal bio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Full Name & Job Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prof-name" className="text-xs font-medium flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-teal-400" /> Full Name *
              </Label>
              <Input
                id="prof-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                className="bg-slate-950 border-white/10 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-title" className="text-xs font-medium flex items-center gap-1.5">
                <BriefcaseIcon className="w-3.5 h-3.5 text-teal-400" /> Office Job Title / Post
              </Label>
              <Input
                id="prof-title"
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                placeholder="e.g. Lead Software Engineer"
                className="bg-slate-950 border-white/10 text-xs"
              />
            </div>
          </div>

          {/* Department & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prof-dept" className="text-xs font-medium flex items-center gap-1.5">
                <BuildingIcon className="w-3.5 h-3.5 text-teal-400" /> Department / Team
              </Label>
              <Input
                id="prof-dept"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="e.g. Engineering, Product, Design"
                className="bg-slate-950 border-white/10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-loc" className="text-xs font-medium flex items-center gap-1.5">
                <MapPinIcon className="w-3.5 h-3.5 text-teal-400" /> Office / Work Location
              </Label>
              <Input
                id="prof-loc"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Kathmandu HQ - Floor 3"
                className="bg-slate-950 border-white/10 text-xs"
              />
            </div>
          </div>

          {/* Phone & Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prof-phone" className="text-xs font-medium flex items-center gap-1.5">
                <PhoneIcon className="w-3.5 h-3.5 text-teal-400" /> Phone / Extension
              </Label>
              <Input
                id="prof-phone"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. +977 9801234567"
                className="bg-slate-950 border-white/10 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-tz" className="text-xs font-medium flex items-center gap-1.5">
                <GlobeIcon className="w-3.5 h-3.5 text-teal-400" /> Timezone
              </Label>
              <Input
                id="prof-tz"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                placeholder="e.g. Asia/Kathmandu"
                className="bg-slate-950 border-white/10 text-xs font-mono"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <Label htmlFor="prof-bio" className="text-xs font-medium">About / Bio</Label>
            <Textarea
              id="prof-bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Short bio about your role, responsibilities, or interests..."
              rows={3}
              className="bg-slate-950 border-white/10 text-xs resize-none"
            />
          </div>

          {/* Social Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prof-github" className="text-xs font-medium">GitHub Profile URL</Label>
              <Input
                id="prof-github"
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username"
                className="bg-slate-950 border-white/10 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-linkedin" className="text-xs font-medium">LinkedIn Profile URL</Label>
              <Input
                id="prof-linkedin"
                value={linkedinUrl}
                onChange={e => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className="bg-slate-950 border-white/10 text-xs font-mono"
              />
            </div>
          </div>

          {errorMsg && <p className="text-xs font-mono text-red-400 pt-1">{errorMsg}</p>}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs font-mono uppercase border-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || saving}
              className="bg-teal-500 hover:bg-teal-400 text-black font-semibold text-xs uppercase tracking-wider active:scale-[0.97]"
            >
              {saving ? <Loader2Icon className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Save Profile Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
