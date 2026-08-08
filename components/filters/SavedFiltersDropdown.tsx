'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { BookmarkIcon, CheckIcon, Trash2Icon, Share2Icon, PlusIcon } from 'lucide-react'

export function SavedFiltersDropdown({ scope }: { scope: 'board' | 'list' }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  const savedFilters = useQuery(api.savedFilters.myFilters, { scope }) ?? []
  const createFilter = useMutation(api.savedFilters.create)
  const removeFilter = useMutation(api.savedFilters.remove)
  const shareFilter = useMutation(api.savedFilters.share)

  const [popoverOpen, setPopoverOpen] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [filterName, setFilterName] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleApply = (qs: string) => {
    setPopoverOpen(false)
    router.push(`${pathname}?${qs}`)
  }

  const handleCreate = async () => {
    if (!filterName.trim()) {
      toast.error('Please enter a filter name')
      return
    }
    setIsSaving(true)
    try {
      await createFilter({
        name: filterName,
        scope,
        queryString,
        isShared,
      })
      toast.success('Saved view created')
      setSaveModalOpen(false)
      setFilterName('')
      setIsShared(false)
    } catch (err: any) {
      toast.error('Failed to save view', err?.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: any) => {
    e.stopPropagation()
    try {
      await removeFilter({ id })
      toast.success('Saved view removed')
    } catch (err: any) {
      toast.error('Failed to remove view', err?.message)
    }
  }

  const handleToggleShare = async (e: React.MouseEvent, id: any, currentShare: boolean) => {
    e.stopPropagation()
    try {
      await shareFilter({ id, isShared: !currentShare })
      toast.success(currentShare ? 'Unshared view' : 'Shared view with team')
    } catch (err: any) {
      toast.error('Failed to update share setting', err?.message)
    }
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger className="inline-flex items-center gap-1.5 px-3 py-1.5 h-8 text-xs font-medium border border-border/80 border-dashed rounded-md bg-card hover:bg-accent text-foreground cursor-pointer transition-colors">
          <BookmarkIcon className="w-3.5 h-3.5 text-teal-400" />
          <span>Saved Views</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-border/40">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {scope === 'board' ? 'Board Views' : 'List Views'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] px-1.5 text-teal-400 hover:text-teal-300"
              onClick={() => {
                setPopoverOpen(false)
                setSaveModalOpen(true)
              }}
            >
              <PlusIcon className="w-3 h-3 mr-0.5" />
              Save current
            </Button>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {savedFilters.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2 text-center">
                No saved views yet.
              </p>
            ) : (
              savedFilters.map(f => {
                const isActive = queryString === f.queryString
                return (
                  <div
                    key={f._id}
                    onClick={() => handleApply(f.queryString)}
                    className={`flex items-center justify-between p-1.5 rounded cursor-pointer text-xs group transition-colors ${
                      isActive ? 'bg-teal-500/15 text-teal-300 font-medium' : 'hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isActive && <CheckIcon className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
                      <span className="truncate">{f.name}</span>
                      {f.isShared && (
                        <span className="text-[10px] px-1 py-0.2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">
                          Shared
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-purple-400"
                        title={f.isShared ? 'Unshare with team' : 'Share with team'}
                        onClick={e => handleToggleShare(e, f._id, f.isShared)}
                      >
                        <Share2Icon className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-red-400"
                        title="Delete view"
                        onClick={e => handleDelete(e, f._id)}
                      >
                        <Trash2Icon className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Save Current View</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">View Name</Label>
              <Input
                type="text"
                placeholder="e.g. My Urgent Bugs"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="shareCheck"
                checked={isShared}
                onChange={e => setIsShared(e.target.checked)}
                className="rounded border-border text-teal-500 focus:ring-teal-400 h-4 w-4"
              />
              <label htmlFor="shareCheck" className="text-xs text-foreground cursor-pointer">
                Share this view with team members
              </label>
            </div>
          </div>
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setSaveModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={isSaving} className="bg-teal-600 hover:bg-teal-500 text-white">
              {isSaving ? 'Saving...' : 'Save View'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
