import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TeamsClient } from "./teams-client"

interface Address {
  street?: string
  city?: string
  state?: string
  zipCode?: string
}

interface TeamMember {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  gender: string | null
  age: number | null
  address?: Address | null
  current_team_id?: string | null
  created_at: string
  role?: string | null
}

interface Team {
  id: string
  name: string
  manager_id: string
  members: string[]
  details?: string | null
  is_high_school?: boolean
  created_at: string
  updated_at?: string | null
  memberDetails?: TeamMember[]
}

interface Invitation {
  id: string
  from_user_id: string
  to_user_id: string | null
  to_email: string | null
  team_id: string
  status: string
  type: string
  invite_link: string | null
  created_at: string
  team: {
    id: string
    name: string
  } | null
  to_user: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
  from_user: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

export default async function ManagerTeamsPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const query = await searchParams?.q?.toLowerCase() ?? ""
  

  // Get manager/AM profile
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  const isAssistantManager = profile?.role === "assistant_manager"

  if (profile?.role !== "manager" && profile?.role !== "assistant_manager") {
    redirect("/auth/login")
  }

  let teamsToShow: any[] = []

  if (isAssistantManager) {
    const { data: amRecord } = await supabase
      .from("assistant_managers")
      .select("team_id")
      .eq("user_id", user.id)
      .single()

    if (amRecord?.team_id) {
      const { data: amTeam } = await supabase
        .from("teams")
        .select("*")
        .eq("id", amRecord.team_id)
        .single()

      if (amTeam) teamsToShow = [amTeam]
    }
  } else {
    const { data: myTeams } = await supabase
      .from("teams")
      .select("*")
      .eq("manager_id", user.id)
      .order("name")

    teamsToShow = myTeams || []
  }

  // FRONTEND SEARCH FILTER
  if (query) {
    teamsToShow = teamsToShow.filter((team) =>
      team.name?.toLowerCase().includes(query)
    )
  }

  // Fetch member details
  const teamsWithMembers: Team[] = []

  for (const team of teamsToShow || []) {
    const memberIds = team.members || []
    let memberDetails: TeamMember[] = []

    const allMemberIds = [...new Set([team.manager_id, ...memberIds])]
    if (allMemberIds.length > 0) {
      const { data: members } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, gender, age, address, past_achievements, disabilities, created_at, updated_at, role")
        .in("id", allMemberIds)

      memberDetails = members || []
    }

    teamsWithMembers.push({
      ...team,
      memberDetails,
    })
  }

  // Get runners
  const { data: allRunners } = await supabase
    .from("users")
    .select(
      "id, first_name, last_name, email, gender, age, address, past_achievements, disabilities, created_at, updated_at, current_team_id, role"
    )
    .in("role", ["runner", "assistant_manager"])
    .order("first_name")

  // Sent invitations
  const { data: sentInvitations } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name),
      to_user:users!invitations_to_user_id_fkey(id, first_name, last_name, email)
    `)
    .eq("from_user_id", user.id)
    .eq("type", "team_join")
    .order("created_at", { ascending: false })

  // Join requests
  const { data: joinRequests } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name),
      from_user:users!invitations_from_user_id_fkey(id, first_name, last_name, email, gender, age)
    `)
    .eq("to_user_id", user.id)
    .eq("type", "team_join")
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  // Assistant managers
  const teamIds = (teamsToShow || []).map((t) => t.id)

  let assistantManagers: {
    id: string
    user_id: string
    assigned_by: string
    created_at: string
    user: {
      id: string
      first_name: string | null
      last_name: string | null
      email: string
      gender: string | null
    } | null
  }[] = []

  if (teamIds.length > 0) {
    const { data: amData } = await supabase
      .from("assistant_managers")
      .select(`
        id, user_id, assigned_by, created_at,
        user:users!assistant_managers_user_id_fkey(id, first_name, last_name, email, gender)
      `)
      .in("team_id", teamIds)

    assistantManagers = (amData as typeof assistantManagers) || []
  }

  return (
    <TeamsClient
      teams={teamsWithMembers}
      allRunners={allRunners || []}
      sentInvitations={(sentInvitations as Invitation[]) || []}
      joinRequests={(joinRequests as Invitation[]) || []}
      managerId={user.id}
      assistantManagers={assistantManagers}
      isAssistantManager={isAssistantManager}
    />
  )
}