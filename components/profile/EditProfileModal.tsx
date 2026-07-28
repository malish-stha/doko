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
import { parseConvexError } from '@/lib/utils'
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
      const msg = parseConvexError(err)
      setErrorMsg(msg)
      toast.error('Failed to update profile', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border text-foreground backdrop-blur-xl p-5 gap-4">
        <DialogHeader className="space-y-1 border-b border-border/60 pb-3">
          <DialogTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-teal-400" />
            Edit Profile Information
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground leading-snug">
            Update your office job details, location, contact info, and personal bio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          {/* Full Name & Job Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="prof-name" className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <UserIcon className="w-3 h-3 text-teal-400/80" /> Full Name *
              </Label>
              <Input
                id="prof-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                className="h-8 text-xs font-sans px-2.5"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="prof-title" className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <BriefcaseIcon className="w-3 h-3 text-teal-400/80" /> Office Job Title / Post
              </Label>
              <Input
                id="prof-title"
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                placeholder="e.g. Lead Software Engineer"
                className="h-8 text-xs font-sans px-2.5"
              />
            </div>
          </div>

          {/* Department & Office Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="prof-dept" className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <BuildingIcon className="w-3 h-3 text-teal-400/80" /> Department
              </Label>
              <Input
                id="prof-dept"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="e.g. Engineering / Product"
                className="h-8 text-xs font-sans px-2.5"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="prof-loc" className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <MapPinIcon className="w-3 h-3 text-teal-400/80" /> Office Location
              </Label>
              <Input
                id="prof-loc"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. San Francisco / Remote"
                className="h-8 text-xs font-sans px-2.5"
              />
            </div>
          </div>

          {/* Phone & Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="prof-phone" className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <PhoneIcon className="w-3 h-3 text-teal-400/80" /> Phone Number / Ext
              </Label>
              <Input
                id="prof-phone"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. +1 (555) 019-2834"
                className="h-8 text-xs font-sans px-2.5"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="prof-tz" className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <GlobeIcon className="w-3 h-3 text-teal-400/80" /> Timezone
              </Label>
              <Input
                id="prof-tz"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                placeholder="e.g. America/New_York"
                className="h-8 text-xs font-sans px-2.5"
              />
            </div>
          </div>

          {/* Bio / Summary */}
          <div className="space-y-1">
            <Label htmlFor="prof-bio" className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <UserIcon className="w-3 h-3 text-teal-400/80" /> Personal Bio / Summary
            </Label>
            <Textarea
              id="prof-bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell your team about your role or focus area…"
              rows={2}
              className="bg-background border-border text-xs font-sans p-2 resize-none"
            />
          </div>

          {/* Social Profiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="prof-gh" className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <GlobeIcon className="w-3 h-3 text-teal-400/80" /> GitHub URL
              </Label>
              <Input
                id="prof-gh"
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username"
                className="h-8 text-xs font-sans px-2.5"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="prof-li" className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <GlobeIcon className="w-3 h-3 text-teal-400/80" /> LinkedIn URL
              </Label>
              <Input
                id="prof-li"
                value={linkedinUrl}
                onChange={e => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className="h-8 text-xs font-sans px-2.5"
              />
            </div>
          </div>

          {errorMsg && <p className="text-[11px] font-mono text-red-400 pt-1">{errorMsg}</p>}

          <DialogFooter className="pt-3 border-t border-border/60 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-mono uppercase px-3 border-border"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || saving}
              className="h-8 bg-teal-500 hover:bg-teal-400 text-black font-semibold text-xs uppercase tracking-wider px-3.5 active:scale-[0.97]"
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
