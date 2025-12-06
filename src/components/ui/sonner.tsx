"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-[var(--notion-green-text)]" />,
        info: <InfoIcon className="size-4 text-[var(--notion-blue-text)]" />,
        warning: <TriangleAlertIcon className="size-4 text-[var(--notion-orange-text)]" />,
        error: <OctagonXIcon className="size-4 text-[var(--notion-red-text)]" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        classNames: {
          toast: "rounded-[3px] border border-border bg-popover text-popover-foreground shadow-md",
          title: "text-sm font-medium",
          description: "text-[13px] text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-[3px]",
          cancelButton: "bg-secondary text-secondary-foreground hover:bg-accent rounded-[3px]",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
