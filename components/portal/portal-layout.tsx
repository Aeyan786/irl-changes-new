"use client"

import React, { useState } from "react"
import { useEffect } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { PortalHeader } from "./portal-header"
import { PortalSidebar, type UserRole } from "./portal-sidebar"
import { PortalFooter } from "./portal-footer"
import { cn } from "@/lib/utils"

interface PortalUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role: UserRole
}

interface PortalLayoutProps {
  children: React.ReactNode
  user: PortalUser | null
  portalTitle: string
  className?: string
}

export function PortalLayout({
  children,
  user,
  portalTitle,
  className,
}: PortalLayoutProps) {
  const userRole = user?.role || "runner"

    const [open,setOpen] = useState(true)

    useEffect(() => {
  const handleResize = () => {
    if (window.innerWidth < 1024) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  };

  handleResize(); // run on mount
  window.addEventListener("resize", handleResize);

  return () => window.removeEventListener("resize", handleResize);
}, []);
  

  return (
    <SidebarProvider open={open} onOpenChange={setOpen} defaultOpen={false}>
      <PortalSidebar role={userRole} />
      <SidebarInset className="flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <PortalHeader
          portalTitle={portalTitle}
          role={userRole}
          user={
            user
              ? {
                  id: user.id,
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                }
              : null
          }
        />
        <main
          id="main-content"
          role="main"
          tabIndex={-1}
          aria-label={`${portalTitle} main content`}
          className={cn(
            "flex-1 p-3 sm:p-4 md:p-6 lg:p-8 focus:outline-none min-w-0",
            className
          )}
        >
          {children}
        </main>
        <PortalFooter />
      </SidebarInset>
    </SidebarProvider>
  )
}

// Export types and components for individual use
export { PortalHeader } from "./portal-header"
export { PortalSidebar, type UserRole } from "./portal-sidebar"
export { PortalFooter } from "./portal-footer"
