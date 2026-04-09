import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { InvitationsClient } from "./invitations-client"

interface Team {
  id: string
  name: string
  manager_id: string
}

interface TeamMember {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

interface ReceivedInvitation {
  id: string
  from_user_id: string
  to_user_id: string | null
  to_email: string | null
  team_id: string
  status: string
  type: string
  invite_link: string | null
  created_at: string
  team: Team | null
  from_user: TeamMember | null
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

interface AmInvitation {
  id: string
  from_user_id: string
  team_id: string
  status: string
  created_at: string
  team: Team | null
  from_user: TeamMember | null
}

async function getInvitationsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const { data: userProfile } = await supabase
    .from("users")
    .select("email, first_name, last_name")
    .eq("id", user.id)
    .single()

  // Get received team_join invitations (pending)
  const { data: receivedInvitations } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name, manager_id),
      from_user:users!invitations_from_user_id_fkey(id, first_name, last_name, email)
    `)
    .eq("status", "pending")
    .eq("type", "team_join")
    .or(`to_user_id.eq.${user.id},to_email.eq.${userProfile?.email || ""}`)
    .order("created_at", { ascending: false })

  // Get pending AM assignment invitations
  const { data: amInvitations } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name, manager_id),
      from_user:users!invitations_from_user_id_fkey(id, first_name, last_name, email)
    `)
    .eq("status", "pending")
    .eq("type", "am_assignment")
    .eq("to_user_id", user.id)
    .order("created_at", { ascending: false })

  // Get sent invitations (all statuses)
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

  // Get user's teams
  const { data: myTeams } = await supabase
    .from("teams")
    .select("id, name, manager_id, members")
    .or(`manager_id.eq.${user.id},members.cs.{${user.id}}`)

  return {
    userId: user.id,
    userEmail: userProfile?.email || "",
    receivedInvitations: (receivedInvitations as ReceivedInvitation[]) || [],
    amInvitations: (amInvitations as AmInvitation[]) || [],
    sentInvitations: (sentInvitations as SentInvitation[]) || [],
    myTeams: myTeams || [],
  }
}

export default async function RunnerInvitationsPage() {
  const data = await getInvitationsData()
  return <InvitationsClient {...data} />
}
