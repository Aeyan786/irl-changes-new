import React from "react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This layout bypasses the admin portal layout for the login page
  return (
    <div className="min-h-screen bg-background">
      {/* Theme toggle in top right */}
    
      {children}
    </div>
  )
}
