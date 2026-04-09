import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ManagerRacesClient } from "./races-client"

export type Race = {
  id: string
  title: string
  date: string
  venue: string
  start_location: string | null
  end_location: string | null
  waypoints: string[] | null
  registration_deadline: string | null
  registration_fee: number
  details: string | null
  rules: string | null
  status: "past" | "current" | "upcoming"
  created_at: string
}

export type Registration = {
  id: string
  race_id: string
  team_id: string
  sub_team_type: "male" | "female" | "co-ed"
  sub_team_types?: ("male" | "female" | "co-ed")[]
  runners: string[]
  runners_by_subteam?: Record<"male" | "female" | "co-ed", string[]>
  payment_status: "pending" | "paid" | "failed"
  paid_amount: number
}

export type Team = {
  id: string
  name: string
  manager_id: string
  members: string[]
}

export type Runner = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  gender: "male" | "female" | null
  age: number | null
}

async function getManagerRacesPageData() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  // Verify user is a manager
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!userProfile || (userProfile.role !== "manager" && userProfile.role !== "assistant_manager")) {
    redirect("/auth/login")
  }

  // Get all races
  const { data: allRaces } = await supabase
    .from("races")
    .select("*")
    .order("date", { ascending: true })

  const now = new Date()

  // Categorize races

  const racesWithStatus = (allRaces || []).map((race) => {
    const raceDate = new Date(race.date)
    const deadline = race.registration_deadline ? new Date(race.registration_deadline) : null
    let status: "upcoming" | "current" | "past" = race.status
    if (raceDate < now) {
      status = "past"
    } else if (deadline && deadline <= now) {
      status = "current"
    } else {
      status = "upcoming"
    }
    return { ...race, status }
  })

  const upcomingRaces = racesWithStatus
    .filter((race) => race.status === "upcoming")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const currentRaces = racesWithStatus.filter((race) => race.status === "current")

  const pastRaces = racesWithStatus.filter((race) => race.status === "past")

  // Get manager's teams
  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("manager_id", user.id)

  // Get registrations for manager's teams
  let registrations: Registration[] = []
  if (teams && teams.length > 0) {
    const teamIds = teams.map((t) => t.id)
    const { data: regs } = await supabase
      .from("registrations")
      .select("*")
      .in("team_id", teamIds)

    registrations = (regs || []) as Registration[]
  }

  // Get all runners in manager's teams
  let runners: Runner[] = []
  if (teams && teams.length > 0) {
    const allMemberIds = new Set<string>()
    for (const team of teams) {
      if (team.members) {
        for (const memberId of team.members) {
          allMemberIds.add(memberId)
        }
      }
    }

    if (allMemberIds.size > 0) {
      const { data: members } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, gender, age")
        .in("id", Array.from(allMemberIds))
        .eq("role", "runner")

      runners = (members || []) as Runner[]
    }
  }

  // Get all registrations across all races to track runner participation
  const { data: allRegistrations } = await supabase
    .from("registrations")
    .select("race_id, runners")

  // Build a map of runner -> race count
  const runnerRaceCount: Record<string, number> = {}
  for (const reg of allRegistrations || []) {
    for (const runnerId of reg.runners || []) {
      runnerRaceCount[runnerId] = (runnerRaceCount[runnerId] || 0) + 1
    }
  }

  return {
    userId: user.id,
    currentRaces: currentRaces as Race[],
    upcomingRaces: upcomingRaces as Race[],
    pastRaces: pastRaces as Race[],
    teams: (teams || []) as Team[],
    registrations,
    runners,
    runnerRaceCount,
  }
}

export default async function ManagerRacesPage() {
  const data = await getManagerRacesPageData()
  return <ManagerRacesClient {...data} />
}
