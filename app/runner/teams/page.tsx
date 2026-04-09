import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TeamsClient } from "./teams-client"

interface TeamMember {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  gender: string | null
  age: number | null
  past_achievements: string | null
}

interface Registration {
  id: string
  status: string
  created_at: string
  race: {
    id: string
    name: string
    date: string
    location?: string | null
  } | null
}

interface Team {
  id: string
  name: string
  manager_id: string
  members: string[]
  details?: string | null
  is_high_school?: boolean
  logo_url?: string | null
  created_at: string
  updated_at?: string | null
  manager: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
  memberDetails?: TeamMember[]
  registrations?: Registration[]
}

interface Invitation {
  id: string
  from_user_id: string
  to_user_id: string | null
  to_email: string | null
  team_id: string
  status: string
  type: string
  created_at: string
  team: {
    id: string
    name: string
    manager_id: string
  } | null
  from_user: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

export default async function RunnerTeamsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get user profile with current_team_id
  const { data: profile } = await supabase
    .from("users")
    .select("*, current_team_id")
    .eq("id", user.id)
    .single()

  // Get pending invitations for this user
  const { data: invitations } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name, manager_id),
      from_user:users!invitations_from_user_id_fkey(id, first_name, last_name, email)
    `)
    .or(`to_user_id.eq.${user.id},to_email.eq.${profile?.email || ""}`)
    .eq("status", "pending")
    .eq("type", "team_join")
    .order("created_at", { ascending: false })

  // Get user's current team (where they are a member)
  const { data: myTeams } = await supabase
    .from("teams")
    .select("*")
    .contains("members", [user.id])

  // Get all teams user is NOT a member of (for "Other Teams" section)
  const { data: allTeams } = await supabase
    .from("teams")
    .select("*")
    .not("members", "cs", `{${user.id}}`)
    .neq("manager_id", user.id)
    .order("name")

  // Get pending join requests sent by this user
  const { data: pendingRequests } = await supabase
    .from("invitations")
    .select("team_id")
    .eq("from_user_id", user.id)
    .eq("status", "pending")
    .eq("type", "team_join")

  const pendingTeamIds = pendingRequests?.map((r) => r.team_id) || []

  // Helper to fetch manager by id directly — avoids foreign key name issues
  async function fetchManager(managerId: string) {
    const { data } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("id", managerId)
      .single()
    return data || null
  }

  // Fetch member details + manager + registrations for myTeams
  const myTeamsWithMembers: Team[] = []
  for (const team of myTeams || []) {
    const memberIds = team.members || []
    let memberDetails: TeamMember[] = []

    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, gender, age, past_achievements")
        .in("id", memberIds)
      memberDetails = members || []
    }

    const manager = await fetchManager(team.manager_id)
console.log("Manager fetch result:", team.manager_id, manager)

const { data: registrations } = await supabase
  .from("registrations")
  .select(`
    id, status, created_at,
    race:races(id, name, date, location)
  `)
  .eq("team_id", team.id)
  .order("created_at", { ascending: false })

myTeamsWithMembers.push({
  ...team,
  manager,
  memberDetails,
  registrations: (registrations as Registration[]) || [],
})
  }

  // Fetch member details + manager for other teams
  const otherTeamsWithMembers: Team[] = []
  for (const team of allTeams || []) {
    const memberIds = team.members || []
    let memberDetails: TeamMember[] = []

    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, gender, age, past_achievements")
        .in("id", memberIds)
      memberDetails = members || []
    }

    const manager = await fetchManager(team.manager_id)

    otherTeamsWithMembers.push({
      ...team,
      manager,
      memberDetails,
    })
  }

  return (
    <TeamsClient
      invitations={(invitations as Invitation[]) || []}
      myTeams={myTeamsWithMembers}
      otherTeams={otherTeamsWithMembers}
      pendingTeamIds={pendingTeamIds}
      userId={user.id}
      currentTeamId={profile?.current_team_id || null}
    />
  )
}
