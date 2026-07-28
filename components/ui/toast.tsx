"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"

import { cn, parseConvexError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

export interface ToastOptions {
  timeout?: number
}

const baseToast = ToastPrimitive.createToastManager()

const toast = Object.assign(baseToast, {
  success: (title: React.ReactNode, description?: React.ReactNode, options?: ToastOptions) =>
    baseToast.add({ title, description, type: "success", ...options }),
  error: (title: React.ReactNode, errorOrDescription?: unknown, options?: ToastOptions) => {
    const description =
      errorOrDescription !== undefined
        ? parseConvexError(errorOrDescription)
        : undefined

    return baseToast.add({ title, description, type: "error", priority: "high", ...options })
  },
  info: (title: React.ReactNode, description?: React.ReactNode, options?: ToastOptions) =>
    baseToast.add({ title, description, type: "info", ...options }),
  warning: (title: React.ReactNode, description?: React.ReactNode, options?: ToastOptions) =>
    baseToast.add({ title, description, type: "warning", ...options }),
})


function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider {...props} />
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-sm outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full",
        className
      )}
      {...props}
    />
  )
}

function Toast({ className, type, ...props }: ToastPrimitive.Root.Props & { type?: string }) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      data-type={type}
      className={cn(
        "group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom rounded-none border border-slate-800 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-xl will-change-transform outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "data-[type=success]:border-teal-500/40 data-[type=success]:shadow-teal-500/10",
        "data-[type=error]:border-rose-500/40 data-[type=error]:shadow-rose-500/10",
        "data-[type=warning]:border-amber-500/40 data-[type=warning]:shadow-amber-500/10",
        "data-[type=info]:border-cyan-500/40 data-[type=info]:shadow-cyan-500/10",
        "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
        "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms]",
        "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
        "data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]",
        "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
        "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        className
      )}
      {...props}
    />
  )
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn(
        "flex h-full items-center gap-3 overflow-hidden px-4 py-3 transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-behind:opacity-0 data-expanded:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-xs font-semibold tracking-tight text-slate-100 font-sans", className)}
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-xs text-slate-400 font-sans leading-snug", className)}
      {...props}
    />
  )
}

function ToastAction({
  className,
  render = <Button variant="outline" size="sm" />,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      render={render}
      className={cn("shrink-0", className)}
      {...props}
    />
  )
}

function ToastClose({
  className,
  children,
  render = <Button variant="ghost" size="icon-sm" />,
  ...props
}: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Close toast"
      render={render}
      className={cn(
        "relative shrink-0 text-slate-400 after:absolute after:-inset-2 after:content-[''] hover:text-white transition-colors",
        className
      )}
      {...props}
    >
      {children ?? (
        <XIcon aria-hidden="true" className="w-3.5 h-3.5" />
      )}
    </ToastPrimitive.Close>
  )
}

function ToastIcon({ type }: { type: string | undefined }) {
  if (type === "success") {
    return (
      <span
        data-slot="toast-icon"
        className="shrink-0 p-1.5 rounded-none bg-teal-500/15 border border-teal-500/30 text-teal-400 shadow-sm"
      >
        <CircleCheckIcon className="w-4 h-4" aria-hidden="true" />
      </span>
    )
  }

  if (type === "info") {
    return (
      <span
        data-slot="toast-icon"
        className="shrink-0 p-1.5 rounded-none bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-sm"
      >
        <InfoIcon className="w-4 h-4" aria-hidden="true" />
      </span>
    )
  }

  if (type === "warning") {
    return (
      <span
        data-slot="toast-icon"
        className="shrink-0 p-1.5 rounded-none bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm"
      >
        <TriangleAlertIcon className="w-4 h-4" aria-hidden="true" />
      </span>
    )
  }

  if (type === "error") {
    return (
      <span
        data-slot="toast-icon"
        className="shrink-0 p-1.5 rounded-none bg-rose-500/15 border border-rose-500/30 text-rose-400 shadow-sm"
      >
        <OctagonXIcon className="w-4 h-4" aria-hidden="true" />
      </span>
    )
  }

  if (type === "loading") {
    return (
      <span
        data-slot="toast-icon"
        className="shrink-0 p-1.5 rounded-none bg-slate-500/15 border border-slate-500/30 text-slate-300 shadow-sm"
      >
        <Loader2Icon className="w-4 h-4 animate-spin" aria-hidden="true" />
      </span>
    )
  }

  return null
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()

  return toasts.map((toastItem) => (
    <Toast key={toastItem.id} toast={toastItem} type={toastItem.type}>
      <ToastContent>
        <ToastIcon type={toastItem.type} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <ToastTitle />
          <ToastDescription />
        </div>
        <ToastAction />
        <ToastClose />
      </ToastContent>
    </Toast>
  ))
}

function Toaster({
  children,
  toastManager = toast,
  ...props
}: ToastPrimitive.Provider.Props) {
  return (
    <ToastProvider toastManager={toastManager} {...props}>
      {children}
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  )
}

const createToastManager = ToastPrimitive.createToastManager
const useToastManager = ToastPrimitive.useToastManager

export {
  Toaster,
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  createToastManager,
  toast,
  useToastManager,
}
