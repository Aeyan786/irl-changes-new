import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { InvitationsClient } from "./invitations-client"

interface TeamMember {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  gender: string | null
  age: number | null
}

interface Team {
  id: string
  name: string
  manager_id: string
  members: string[] | null
}

interface SentInvitation {
  id: string
  from_user_id: string
  to_user_id: string | null
  to_email: string | null
  team_id: string
  status: string
  type: string
  invite_link: string | null
  created_at: string
  team: { id: string; name: string } | null
  to_user: TeamMember | null
}

interface JoinRequest {
  id: string
  from_user_id: string
  to_user_id: string | null
  to_email: string | null
  team_id: string
  status: string
  type: string
  invite_link: string | null
  created_at: string
  team: { id: string; name: string } | null
  from_user: TeamMember | null
}

export default async function ManagerInvitationsPage() {
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

  // Get teams managed by this user (or teams they are an AM of)
  let myTeams: Team[] = []
  if (profile.role === "assistant_manager") {
    // AMs: find the team they belong to via current_team_id
    const { data: amTeams } = await supabase
      .from("teams")
      .select("*")
      .eq("id", profile.current_team_id)
      .order("name")
    myTeams = (amTeams as Team[]) || []
  } else {
    const { data: managerTeams } = await supabase
      .from("teams")
      .select("*")
      .eq("manager_id", user.id)
      .order("name")
    myTeams = (managerTeams as Team[]) || []
  }

  // Get invitations sent by this manager (all statuses)
  const { data: sentInvitations } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name),
      to_user:users!invitations_to_user_id_fkey(id, first_name, last_name, email, gender, age)
    `)
    .eq("from_user_id", user.id)
    .eq("type", "team_join")
    .order("created_at", { ascending: false })

  // Get join requests from runners (invitations TO manager for their teams)
  // These are requests where runners want to join the manager's teams
  const teamIds = (myTeams || []).map((t) => t.id)
  
  let joinRequests: JoinRequest[] = []
  if (teamIds.length > 0) {
    const { data: requests } = await supabase
      .from("invitations")
      .select(`
        *,
        team:teams(id, name),
        from_user:users!invitations_from_user_id_fkey(id, first_name, last_name, email, gender, age)
      `)
      .in("team_id", teamIds)
      .eq("type", "team_join")
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    joinRequests = (requests as JoinRequest[]) || []
  }

  return (
    <InvitationsClient
      teams={(myTeams as Team[]) || []}
      sentInvitations={(sentInvitations as SentInvitation[]) || []}
      joinRequests={joinRequests}
      managerId={user.id}
      managerEmail={profile.email}
    />
  )
}
