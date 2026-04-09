import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ExploreTeamsClient } from "./explore-teams-client"

interface TeamMember {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  gender: string | null
  age: number | null
  past_achievements: string | null
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
  manager: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
  memberDetails?: TeamMember[]
}

export default async function ExploreTeamsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("users")
    .select("*, current_team_id")
    .eq("id", user.id)
    .single()

  // Teams user is NOT a member of and is not the manager of
  const { data: allTeams } = await supabase
    .from("teams")
    .select("*")
    .not("members", "cs", `{${user.id}}`)
    .neq("manager_id", user.id)
    .order("name")

  // Pending join requests sent by this user
  const { data: pendingRequests } = await supabase
    .from("invitations")
    .select("team_id")
    .eq("from_user_id", user.id)
    .eq("status", "pending")
    .eq("type", "team_join")

  const pendingTeamIds = pendingRequests?.map((r) => r.team_id) || []

  async function fetchManager(managerId: string) {
    const { data } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("id", managerId)
      .single()
    return data || null
  }

  const teamsWithMembers: Team[] = []
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
    teamsWithMembers.push({ ...team, manager, memberDetails })
  }

  return (
    <ExploreTeamsClient
      teams={teamsWithMembers}
      pendingTeamIds={pendingTeamIds}
      userId={user.id}
      currentTeamId={profile?.current_team_id || null}
    />
  )
}
