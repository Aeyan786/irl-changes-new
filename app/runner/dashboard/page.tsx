import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { RunnerDashboardClient } from "./dashboard-client"

export type UserInfo = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  age: number | null
  gender: "male" | "female" | null
  address: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
  } | null
  past_achievements: string | null
  disabilities: string | null
  current_team_id: string | null
}

export type Race = {
  id: string
  title: string
  date: string
  venue: string
  details: string | null
  status: "past" | "current" | "upcoming"
}

export type Registration = {
  id: string
  race_id: string
  team_id: string
  sub_team_type: "male" | "female" | "co-ed"
  sub_team_types?: ("male" | "female" | "co-ed")[]
  runners: string[]
  payment_status: "pending" | "paid" | "failed"
  paid_amount: number
  race: Race
}

export type TeamMember = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  gender: "male" | "female" | "other" | null
}

export type Team = {
  id: string
  name: string
  manager_id: string
  members: string[]
  is_high_school?: boolean
  manager?: TeamMember
  memberDetails?: TeamMember[]
}

async function getRunnerDashboardData() {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect("/auth/login")
  }

  // Get user profile
  const { data: userProfile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  // Get teams where user is a member
  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .or(`manager_id.eq.${user.id},members.cs.{${user.id}}`)

  // Get team with member details
  let teamWithDetails: Team | null = null
  if (teams && teams.length > 0) {
    const team = teams[0] as Team
    
    // Get manager details
    const { data: manager } = await supabase
      .from("users")
      .select("id, first_name, last_name, email, gender")
      .eq("id", team.manager_id)
      .single()
    
    // Get member details
    let memberDetails: TeamMember[] = []
    if (team.members && team.members.length > 0) {
      const { data: members } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, gender")
        .in("id", team.members)
      
      memberDetails = (members || []) as TeamMember[]
    }
    
    teamWithDetails = {
      ...team,
      manager: manager as TeamMember || undefined,
      memberDetails
    }
  }

  // Get registrations for user's teams with race details
  let registrations: Registration[] = []
  if (teams && teams.length > 0) {
    const teamIds = teams.map((t) => t.id)
    
    const { data: regs } = await supabase
      .from("registrations")
      .select(`
        *,
        race:races(*)
      `)
      .in("team_id", teamIds)
      .order("created_at", { ascending: false })
    
    registrations = (regs || []) as Registration[]
  }

  // Get all upcoming races
  const { data: upcomingRaces } = await supabase
    .from("races")
    .select("*")
    .eq("status", "upcoming")
    .order("date", { ascending: true })
    .limit(5)

  // Get pending invitations for the user
  const { data: pendingInvitations } = await supabase
    .from("invitations")
    .select("*")
    .or(`to_user_id.eq.${user.id},to_email.eq.${user.email}`)
    .eq("status", "pending")

  return {
    user: userProfile as UserInfo | null,
    team: teamWithDetails,
    registrations,
    upcomingRaces: (upcomingRaces || []) as Race[],
    pendingInvitations: pendingInvitations || []
  }
}

export default async function RunnerDashboard() {
  const data = await getRunnerDashboardData()
  
  return <RunnerDashboardClient {...data} />
}
