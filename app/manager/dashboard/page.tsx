import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ManagerDashboardClient } from "./dashboard-client"

export type ManagerInfo = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  age: number | null
  gender: "male" | "female" | "other" | null
  address: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
  } | null
}

export type TeamMember = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  gender: "male" | "female" | null
  age: number | null
}

export type Team = {
  id: string
  name: string
  manager_id: string
  members: string[]
  is_high_school?: boolean
  logo_url?: string | null
  memberDetails?: TeamMember[]
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
  team?: { name: string }
}

export type RunnerStats = {
  totalRunners: number
  maleCount: number
  femaleCount: number
  otherCount: number
  ageRanges: {
    range: string
    count: number
  }[]
}

async function getManagerDashboardData() {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect("/auth/login")
  }

  // Get user profile and verify they are a manager
  const { data: userProfile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (userProfile?.role !== "manager" && userProfile?.role !== "assistant_manager") {
    redirect("/auth/login")
  }

  // Get teams — for managers fetch by manager_id, for AMs fetch via current_team_id
  let teams = null
  if (userProfile?.role === "assistant_manager") {
    const teamId = userProfile?.current_team_id
    if (teamId) {
      const { data } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
      teams = data
    }
  } else {
    const { data } = await supabase
      .from("teams")
      .select("*")
      .eq("manager_id", user.id)
      .order("created_at", { ascending: false })
    teams = data
  }

  // Get all member details from all teams
  let allMembers: TeamMember[] = []
  const teamsWithDetails: Team[] = []

  if (teams && teams.length > 0) {
    const allMemberIds = teams.reduce<string[]>((acc, team) => {
      return [...acc, ...(team.members || [])]
    }, [])
    
    const uniqueMemberIds = [...new Set(allMemberIds)]
    
    if (uniqueMemberIds.length > 0) {
      const { data: members } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, gender, age")
        .in("id", uniqueMemberIds)
      
      allMembers = (members || []) as TeamMember[]
    }
    
    // Map member details to each team
    for (const team of teams) {
      const memberDetails = (team.members || [])
        .map((id: string) => allMembers.find(m => m.id === id))
        .filter(Boolean) as TeamMember[]
      
      teamsWithDetails.push({
        ...team,
        memberDetails
      })
    }
  }

  // Calculate runner stats
  const runnerStats: RunnerStats = {
    totalRunners: allMembers.length,
    maleCount: allMembers.filter(m => m.gender === "male").length,
    femaleCount: allMembers.filter(m => m.gender === "female").length,
otherCount: allMembers.filter(m => !m.gender).length,    ageRanges: calculateAgeRanges(allMembers)
  }

  // Get registrations for manager's teams with race details
  let registrations: Registration[] = []
  if (teams && teams.length > 0) {
    const teamIds = teams.map((t) => t.id)
    
    const { data: regs } = await supabase
      .from("registrations")
      .select(`
        *,
        race:races(*),
        team:teams(name)
      `)
      .in("team_id", teamIds)
      .order("created_at", { ascending: false })
    
    registrations = (regs || []) as Registration[]
  }

  // Get pending invitations sent by manager
  const { data: pendingInvitations } = await supabase
    .from("invitations")
    .select(`
      id,
      type,
      status,
      created_at,
      to_user:users!invitations_to_user_id_fkey(id, first_name, last_name, email),
      team:teams(id, name)
    `)
    .eq("from_user_id", user.id)
    .eq("status", "pending")
    .limit(3)

  // Get upcoming races
  const { data: upcomingRaces } = await supabase
    .from("races")
    .select("*")
    .eq("status", "upcoming")
    .order("date", { ascending: true })
    .limit(5)

  return {
    manager: userProfile as ManagerInfo | null,
    role: userProfile?.role as "manager" | "assistant_manager",
    teams: teamsWithDetails,
    registrations,
    runnerStats,
    pendingInvitations: pendingInvitations || [],
    upcomingRaces: (upcomingRaces || []) as Race[]
  }
}

function calculateAgeRanges(members: TeamMember[]): { range: string; count: number }[] {
  const ranges = {
    "18-24": 0,
    "25-34": 0,
    "35-44": 0,
    "45-54": 0,
    "55+": 0,
  }

  members.forEach(member => {
    const age = member.age
    if (!age) return
    
    if (age >= 18 && age <= 24) ranges["18-24"]++
    else if (age >= 25 && age <= 34) ranges["25-34"]++
    else if (age >= 35 && age <= 44) ranges["35-44"]++
    else if (age >= 45 && age <= 54) ranges["45-54"]++
    else if (age >= 55) ranges["55+"]++
  })

  return Object.entries(ranges).map(([range, count]) => ({ range, count }))
}

export default async function ManagerDashboard() {
  const data = await getManagerDashboardData()
  
  return <ManagerDashboardClient {...data} />
}
