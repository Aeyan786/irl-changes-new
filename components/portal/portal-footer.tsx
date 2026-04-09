"use client"

import { cn } from "@/lib/utils"

interface PortalFooterProps {
  className?: string
}

export function PortalFooter({ className }: PortalFooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className={cn(
        "border-t border-border/50 bg-background/80 backdrop-blur-sm px-4 py-4 text-center",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">
        Copyright {currentYear} Infinite Running League
      </p>
    </footer>
  )
}
