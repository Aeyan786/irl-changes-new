import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function PortalSelectPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: userData } = await supabase
    .from("users")
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single()

  // Only assistant managers should land here
  if (userData?.role !== "assistant_manager") {
    if (userData?.role === "admin") redirect("/admin/dashboard")
    else if (userData?.role === "manager") redirect("/manager/dashboard")
    else redirect("/runner/dashboard")
  }

  const firstName = userData?.first_name || "there"

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EE0505] mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/white_red_irl_fav_icon__1_-removebg-preview.png"
              alt="IRL Logo"
              className="h-12 w-12 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold">Welcome back, {firstName}</h1>
          <p className="text-muted-foreground text-sm">
            You have access to two portals as an Assistant Manager.
            <br />
            Which would you like to enter?
          </p>
        </div>

        {/* Portal Cards */}
        <div className="grid gap-4">
          {/* Manager Portal */}
          <Link href="/manager/dashboard" className="group block">
            <div className="rounded-xl border-2 border-border bg-card p-6 transition-all hover:border-[#EE0505] hover:shadow-lg hover:shadow-[#EE0505]/10">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-[#EE0505]/10 p-3 text-[#EE0505]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-lg group-hover:text-[#EE0505] transition-colors">
                    Manager Portal
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage team roster, view registrations, handle payments, send invitations, and more.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Team Roster", "Registrations", "Payments", "Invitations"].map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground group-hover:text-[#EE0505] transition-colors mt-1 shrink-0"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Runner Portal */}
          <Link href="/runner/dashboard" className="group block">
            <div className="rounded-xl border-2 border-border bg-card p-6 transition-all hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-blue-500/10 p-3 text-blue-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-lg group-hover:text-blue-600 transition-colors">
                    Runner Portal
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    View your personal race schedule, your team membership, results, and your own profile.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["My Races", "My Team", "Results", "Invitations"].map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground group-hover:text-blue-600 transition-colors mt-1 shrink-0"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          You can switch between portals at any time from the sidebar.
        </p>
      </div>
    </div>
  )
}
