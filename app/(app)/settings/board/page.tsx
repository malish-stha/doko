'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { LayoutGridIcon, EyeIcon, EyeOffIcon, ArrowUpIcon, ArrowDownIcon } from 'lucide-react'

const DEFAULT_COLUMNS = [
  { status: 'backlog', defaultLabel: 'Backlog' },
  { status: 'todo', defaultLabel: 'Todo' },
  { status: 'in_progress', defaultLabel: 'In Progress' },
  { status: 'review', defaultLabel: 'Review' },
  { status: 'done', defaultLabel: 'Done' },
]

export default function BoardSettingsPage() {
  const config = useQuery(api.boardConfig.forMyTeam, {})
  const upsertConfig = useMutation(api.boardConfig.upsert)

  const [wipLimits, setWipLimits] = useState<Record<string, number | undefined>>({})
  const [columnLabels, setColumnLabels] = useState<Record<string, string>>({})
  const [orderedColumns, setOrderedColumns] = useState<string[]>([
    'backlog',
    'todo',
    'in_progress',
    'review',
    'done',
  ])
  const [visibleColumnsSet, setVisibleColumnsSet] = useState<Set<string>>(
    new Set(['backlog', 'todo', 'in_progress', 'review', 'done']),
  )
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (config) {
      if (config.wipLimits) setWipLimits(config.wipLimits)
      if (config.columnLabels) setColumnLabels(config.columnLabels)
      if (config.visibleColumns && config.visibleColumns.length > 0) {
        setOrderedColumns(config.visibleColumns)
        setVisibleColumnsSet(new Set(config.visibleColumns))
      }
    }
  }, [config])

  const handleWipChange = (status: string, val: string) => {
    const num = val === '' ? undefined : parseInt(val, 10)
    setWipLimits(prev => ({ ...prev, [status]: isNaN(num as number) ? undefined : num }))
  }

  const handleLabelChange = (status: string, val: string) => {
    setColumnLabels(prev => ({ ...prev, [status]: val }))
  }

  const toggleVisibility = (status: string) => {
    setVisibleColumnsSet(prev => {
      const next = new Set(prev)
      if (next.has(status)) {
        if (next.size <= 1) {
          toast.error('At least one column must remain visible')
          return prev
        }
        next.delete(status)
      } else {
        next.add(status)
      }
      return next
    })
  }

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const nextCols = [...orderedColumns]
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= nextCols.length) return
    const temp = nextCols[index]
    nextCols[index] = nextCols[targetIdx]
    nextCols[targetIdx] = temp
    setOrderedColumns(nextCols)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const finalVisibleColumns = orderedColumns.filter(c => visibleColumnsSet.has(c))
      await upsertConfig({
        wipLimits,
        columnLabels,
        visibleColumns: finalVisibleColumns,
      })
      toast.success('Board configuration saved successfully')
    } catch (err: any) {
      toast.error('Failed to save settings', err?.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <LayoutGridIcon className="w-5 h-5 text-teal-400" />
          Board Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure column labels, WIP limits, visibility, and column order for your team board.
        </p>
      </div>

      <Card className="border border-border/80">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Columns & WIP Limits</CardTitle>
          <CardDescription className="text-xs">
            Set maximum tickets per column (WIP limits) to highlight bottlenecks. Reorder or customize labels as needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {orderedColumns.map((status, index) => {
              const defaultObj = DEFAULT_COLUMNS.find(c => c.status === status)
              const defaultName = defaultObj?.defaultLabel ?? status
              const isVisible = visibleColumnsSet.has(status)

              return (
                <div
                  key={status}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-md transition-colors ${
                    isVisible ? 'bg-card border-border/60' : 'bg-muted/30 border-border/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground"
                        disabled={index === 0}
                        onClick={() => moveColumn(index, 'up')}
                      >
                        <ArrowUpIcon className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground"
                        disabled={index === orderedColumns.length - 1}
                        onClick={() => moveColumn(index, 'down')}
                      >
                        <ArrowDownIcon className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={`h-7 px-2 text-xs font-mono ${
                        isVisible ? 'text-teal-400 hover:text-teal-300' : 'text-muted-foreground'
                      }`}
                      onClick={() => toggleVisibility(status)}
                    >
                      {isVisible ? (
                        <EyeIcon className="w-3.5 h-3.5 mr-1" />
                      ) : (
                        <EyeOffIcon className="w-3.5 h-3.5 mr-1" />
                      )}
                      {isVisible ? 'Visible' : 'Hidden'}
                    </Button>
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground mb-1 block">
                        Display Label ({defaultName})
                      </Label>
                      <Input
                        type="text"
                        placeholder={defaultName}
                        value={columnLabels[status] ?? ''}
                        onChange={e => handleLabelChange(status, e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground mb-1 block">
                        WIP Limit (optional max cards)
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="No limit"
                        value={wipLimits[status] ?? ''}
                        onChange={e => handleWipChange(status, e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>

        <CardFooter className="flex justify-end border-t border-border/40 pt-4">
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-teal-600 hover:bg-teal-500 text-white">
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
