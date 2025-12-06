import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[3px] px-[6px] py-[2px] text-[12px] font-normal w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors duration-100",
  {
    variants: {
      variant: {
        default: "bg-[var(--notion-default)] text-[var(--notion-default-text)]",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-[var(--notion-red)] text-[var(--notion-red-text)]",
        outline: "border border-border text-foreground bg-transparent",
        gray: "bg-[var(--notion-gray)] text-[var(--notion-gray-text)]",
        brown: "bg-[var(--notion-brown)] text-[var(--notion-brown-text)]",
        orange: "bg-[var(--notion-orange)] text-[var(--notion-orange-text)]",
        yellow: "bg-[var(--notion-yellow)] text-[var(--notion-yellow-text)]",
        green: "bg-[var(--notion-green)] text-[var(--notion-green-text)]",
        blue: "bg-[var(--notion-blue)] text-[var(--notion-blue-text)]",
        purple: "bg-[var(--notion-purple)] text-[var(--notion-purple-text)]",
        pink: "bg-[var(--notion-pink)] text-[var(--notion-pink-text)]",
        red: "bg-[var(--notion-red)] text-[var(--notion-red-text)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
