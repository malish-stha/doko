import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 border border-input bg-background px-3 py-1.5 text-xs font-sans text-foreground placeholder:text-muted-foreground/50 transition-colors outline-none focus-visible:border-teal-500 focus-visible:ring-1 focus-visible:ring-teal-500 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 rounded-none",
        className
      )}
      {...props}
    />
  )
}

export { Input }
