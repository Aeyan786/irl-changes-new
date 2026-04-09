"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

interface TeamLogoProps {
  logoUrl?: string | null
  teamName: string
  size?: number         // px, default 40
  className?: string
  textClassName?: string
}

/**
 * Shows team logo if available, otherwise shows initials fallback.
 * Always renders a square with rounded corners.
 */
export function TeamLogo({
  logoUrl,
  teamName,
  size = 40,
  className,
  textClassName,
}: TeamLogoProps) {
  const initials = teamName.substring(0, 2).toUpperCase()
  const fontSize = Math.max(10, Math.round(size * 0.3))

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-red-100 border border-red-200",
        className
      )}
      style={{ width: size, height: size }}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${teamName} logo`}
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <span
          className={cn("font-bold text-red-600 select-none", textClassName)}
          style={{ fontSize }}
        >
          {initials}
        </span>
      )}
    </div>
  )
}
