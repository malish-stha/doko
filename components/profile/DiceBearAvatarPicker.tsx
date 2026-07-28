'use client'

import React, { useState } from 'react'
import {
  getDiceBearThumbsAvatar,
  PRESET_BACKGROUND_COLORS,
} from '@/lib/dicebear'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { SparklesIcon, ShuffleIcon, CheckIcon, RotateCcwIcon, UserIcon } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useSession } from 'next-auth/react'

interface DiceBearAvatarPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentAvatarUrl?: string | null
  userEmail?: string
  userName?: string
}

export function DiceBearAvatarPicker({
  open,
  onOpenChange,
  currentAvatarUrl,
  userEmail,
  userName,
}: DiceBearAvatarPickerProps) {
  const { data: session } = useSession()
  const email = session?.user?.email ?? userEmail
  const updateProfile = useMutation(api.users.updateProfile)

  const defaultSeed = (userName || email || 'doko-user').trim().toLowerCase()
  const [seed, setSeed] = useState<string>(defaultSeed)
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(0)
  const [customUrlInput, setCustomUrlInput] = useState<string>('')
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false)
  const [saving, setSaving] = useState(false)

  const selectedColor = PRESET_BACKGROUND_COLORS[selectedColorIndex]
  const activeAvatarUrl = isCustomMode
    ? customUrlInput.trim()
    : getDiceBearThumbsAvatar(seed || defaultSeed, {
        backgroundColor: selectedColor ? selectedColor.value : undefined,
      })

  const handleRandomizeSeed = () => {
    const randomSeed = Math.random().toString(36).substring(2, 10)
    setSeed(randomSeed)
  }

  const handleSave = async () => {
    if (!email) {
      toast.error('Not authenticated', 'Must be signed in to update profile.')
      return
    }

    if (isCustomMode && !customUrlInput.trim()) {
      toast.error('Invalid URL', 'Please enter a valid image URL.')
      return
    }

    try {
      setSaving(true)
      await updateProfile({
        userEmail: email,
        avatarUrl: activeAvatarUrl,
      })
      toast.success('Avatar updated!', 'Your new DiceBear Thumbs avatar has been saved.')
      onOpenChange(false)
    } catch (err: any) {
      toast.error('Failed to update avatar', err?.message ?? 'An error occurred.')
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefault = async () => {
    if (!email) return
    try {
      setSaving(true)
      const defaultUrl = getDiceBearThumbsAvatar(defaultSeed)
      await updateProfile({
        userEmail: email,
        avatarUrl: defaultUrl,
      })
      toast.success('Avatar reset', 'Reverted to default DiceBear Thumbs avatar.')
      onOpenChange(false)
    } catch (err: any) {
      toast.error('Failed to reset avatar', err?.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card border border-border text-foreground shadow-2xl p-6 font-sans backdrop-blur-xl">
        <DialogHeader className="space-y-1.5 border-b border-border pb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            <SparklesIcon className="w-5 h-5 text-teal-400" />
            Customize DiceBear Thumbs Avatar
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-mono">
            Generated directly with @dicebear/core and @dicebear/thumbs. Every seed generates a unique avatar character!
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Top Row: Preview & Seed Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-background border border-border">
            {/* Avatar Preview Box */}
            <div className="relative group shrink-0">
              <div className="w-28 h-28 rounded-none bg-teal-500/10 border-2 border-teal-500/50 flex items-center justify-center overflow-hidden shadow-lg">
                {activeAvatarUrl ? (
                  <img
                    src={activeAvatarUrl}
                    alt="DiceBear Thumbs Avatar Preview"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <UserIcon className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-teal-500 text-slate-950 text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 border border-teal-400">
                Preview
              </div>
            </div>

            {/* Seed & Controls */}
            <div className="flex-1 min-w-0 space-y-3 w-full">
              <div className="flex items-center justify-between">
                <Label htmlFor="avatar-seed" className="text-xs font-mono uppercase tracking-wider text-teal-300">
                  Avatar Seed Phrase
                </Label>
                <button
                  type="button"
                  onClick={() => setIsCustomMode(!isCustomMode)}
                  className="text-[11px] font-mono text-teal-400 hover:underline cursor-pointer"
                >
                  {isCustomMode ? '← Use Thumbs Generator' : 'Use Custom Image URL →'}
                </button>
              </div>

              {!isCustomMode ? (
                <div className="flex items-center gap-2">
                  <Input
                    id="avatar-seed"
                    value={seed}
                    onChange={e => setSeed(e.target.value)}
                    placeholder="Enter seed phrase or name..."
                    className="bg-background border-border text-xs font-mono focus-visible:ring-teal-500"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRandomizeSeed}
                    className="border-teal-500/40 text-teal-300 hover:bg-teal-500/20 font-mono text-xs shrink-0 flex items-center gap-1.5"
                    title="Randomize seed"
                  >
                    <ShuffleIcon className="w-3.5 h-3.5" />
                    Randomize
                  </Button>
                </div>
              ) : (
                <Input
                  id="custom-url"
                  value={customUrlInput}
                  onChange={e => setCustomUrlInput(e.target.value)}
                  placeholder="https://example.com/my-avatar.png"
                  className="bg-background border-border text-xs font-mono focus-visible:ring-teal-500"
                />
              )}

              <p className="text-[11px] font-mono text-muted-foreground">
                {!isCustomMode
                  ? 'Each unique seed phrase creates a completely unique character design.'
                  : 'Direct URL to any PNG/JPG/SVG image.'}
              </p>
            </div>
          </div>

          {/* Color Presets */}
          {!isCustomMode && (
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-teal-300">
                Background Theme Colors
              </Label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_BACKGROUND_COLORS.map((colorPreset, idx) => {
                  const isSelected = selectedColorIndex === idx
                  return (
                    <button
                      key={colorPreset.name}
                      type="button"
                      onClick={() => setSelectedColorIndex(idx)}
                      className={`flex items-center gap-2 p-2 border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-teal-500/20 border-teal-400 text-teal-200 ring-1 ring-teal-400'
                          : 'bg-background/40 border-border text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-none border border-border shrink-0"
                        style={{ backgroundColor: `#${colorPreset.value[0]}` }}
                      />
                      <span className="text-[11px] font-mono truncate font-medium flex-1">
                        {colorPreset.name}
                      </span>
                      {isSelected && <CheckIcon className="w-3 h-3 text-teal-400 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetDefault}
            disabled={saving}
            className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            <RotateCcwIcon className="w-3.5 h-3.5" />
            Reset to Default
          </Button>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs font-mono border-border"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-mono font-bold text-xs px-4 flex items-center gap-1.5"
            >
              <CheckIcon className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save Avatar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
