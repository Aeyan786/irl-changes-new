import React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PortalLayout } from "@/components/portal"

export default async function RunnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get user role from database (more reliable than metadata)
  const { data: userData } = await supabase
    .from("users")
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single()

  const role = userData?.role

  // Both runners and assistant managers can access the runner portal
  if (role !== "runner" && role !== "assistant_manager") {
    // Redirect to appropriate portal based on role
    if (role === "manager") {
      redirect("/manager/dashboard")
    } else if (role === "admin") {
      redirect("/admin/dashboard")
    } else {
      redirect("/auth/login")
    }
  }

  return (
    <PortalLayout
      portalTitle="Runner Portal"
      user={{
        id: user.id,
        email: user.email || "",
        firstName: userData?.first_name || user.user_metadata?.first_name,
        lastName: userData?.last_name || user.user_metadata?.last_name,
        // Pass actual role so sidebar can show portal-switch for AMs
        role: (role === "assistant_manager" ? "assistant_manager" : "runner") as "runner" | "assistant_manager",
      }}
    >
      {children}
    </PortalLayout>
  )
}
