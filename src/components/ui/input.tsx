import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-8 w-full rounded-[3px] border border-border bg-transparent px-3 py-1.5 text-sm transition-colors duration-100",
        "placeholder:text-muted-foreground",
        "hover:border-foreground/20",
        "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  )
}

export { Input }
