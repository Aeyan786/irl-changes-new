import React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PortalLayout } from "@/components/portal"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/admin-login")
  }

  // Get user role from database (more reliable than metadata)
  const { data: userData } = await supabase
    .from("users")
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single()

  const role = userData?.role

  if (role !== "admin") {
    // Non-admins should not access admin portal
    if (role === "runner") {
      redirect("/runner/dashboard")
    } else if (role === "manager") {
      redirect("/manager/dashboard")
    } else {
      redirect("/auth/login")
    }
  }

  return (
    <PortalLayout
      portalTitle="Admin Portal"
      user={{
        id: user.id,
        email: user.email || "",
        firstName: userData?.first_name || user.user_metadata?.first_name,
        lastName: userData?.last_name || user.user_metadata?.last_name,
        role: "admin",
      }}
    >
      {children}
    </PortalLayout>
  )
}
