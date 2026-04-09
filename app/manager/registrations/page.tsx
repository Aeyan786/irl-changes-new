import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { RegistrationsClient } from "./registrations-client"

interface Runner {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  gender: string | null
}

interface Team {
  id: string
  name: string
  manager_id: string
  members: string[] | null
}

interface Race {
  id: string
  title: string
  date: string
  venue: string
  status: string
}

interface Registration {
  id: string
  race_id: string
  team_id: string
  sub_team_type: string
  sub_team_types?: ("male" | "female" | "co-ed")[]
  runners: string[]
  runners_by_subteam?: Record<"male" | "female" | "co-ed", string[]>
  payment_status: string
  paid_amount: number | null
  created_at: string
  race: Race | null
  team: Team | null
}

export default async function ManagerRegistrationsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get manager profile
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "manager" && profile?.role !== "assistant_manager") {
    redirect("/auth/login")
  }

  // Get teams managed by this user
  const { data: myTeams } = await supabase
    .from("teams")
    .select("*")
    .eq("manager_id", user.id)
    .order("name")

  const teamIds = (myTeams || []).map((t) => t.id)

  // Get registrations for manager's teams
  let registrations: Registration[] = []
  if (teamIds.length > 0) {
    const { data: regs } = await supabase
      .from("registrations")
      .select(`
        *,
        race:races(id, title, date, venue, status),
        team:teams(id, name, manager_id, members)
      `)
      .in("team_id", teamIds)
      .order("created_at", { ascending: false })

    registrations = (regs as Registration[]) || []
  }

  // Get all runners for displaying names
  const allRunnerIds = registrations.flatMap((r) => r.runners || [])
  const uniqueRunnerIds = [...new Set(allRunnerIds)]
  
  let runners: Runner[] = []
  if (uniqueRunnerIds.length > 0) {
    const { data: runnerData } = await supabase
      .from("users")
      .select("id, first_name, last_name, email, gender")
      .in("id", uniqueRunnerIds)

    runners = (runnerData as Runner[]) || []
  }

  return (
    <RegistrationsClient
      registrations={registrations}
      teams={(myTeams as Team[]) || []}
      runners={runners}
      managerId={user.id}
    />
  )
}
