'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface HotkeyBindingItem {
  keys: string
  description?: string
  scope?: string
}

export function HotkeysCheatSheet({
  open,
  onOpenChange,
  bindings,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bindings: HotkeyBindingItem[]
}) {
  const grouped: Record<string, HotkeyBindingItem[]> = {}

  for (const b of bindings) {
    if (!b.description) continue
    const scope = b.scope ?? 'Global'
    grouped[scope] = grouped[scope] ?? []
    grouped[scope].push(b)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2 max-h-[60vh] overflow-y-auto pr-1">
          {Object.keys(grouped).length === 0 ? (
            <p className="text-sm text-muted-foreground">No shortcuts registered.</p>
          ) : (
            Object.entries(grouped).map(([scope, bs]) => (
              <div key={scope} className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {scope}
                </div>
                <div className="space-y-1.5 border border-border/40 rounded-md p-3 bg-muted/20">
                  {bs.map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{b.description}</span>
                      <kbd className="px-2 py-0.5 text-xs font-mono bg-muted border border-border rounded text-muted-foreground shadow-xs">
                        {b.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
