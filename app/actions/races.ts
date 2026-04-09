"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"

type SubTeamType = "male" | "female" | "co-ed"

// Calculate leg assignments for a sub-team based on ordered runners
// Runner at index 0 gets legs 1, 11, 21
// Runner at index 1 gets legs 2, 12, 22 etc.
function calculateLegAssignments(
  orderedRunners: string[],
  totalLegs: number = 30
): Record<string, number[]> {
  const legsPerRunner = totalLegs / orderedRunners.length // 3
  const assignments: Record<string, number[]> = {}

  orderedRunners.forEach((runnerId, index) => {
    const legs: number[] = []
    for (let round = 0; round < legsPerRunner; round++) {
      legs.push(index + 1 + round * orderedRunners.length)
    }
    assignments[runnerId] = legs
  })

  return assignments
}

export async function registerForRace(data: {
  raceId: string
  teamId: string
  subTeamTypes: SubTeamType[]
  runners: Record<SubTeamType, string[]>
  orderedRunners?: Record<SubTeamType, string[]> // ordered for leg assignment
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in to register for a race" }
  }

  if (!data.subTeamTypes || data.subTeamTypes.length === 0) {
    return { error: "Please select at least one sub-team" }
  }

  // ── Fetch race and check registration deadline ──
  const { data: race } = await supabase
    .from("races")
    .select("id, title, date, registration_deadline")
    .eq("id", data.raceId)
    .single()

  if (!race) {
    return { error: "Race not found" }
  }

  if (race.registration_deadline) {
    const deadline = new Date(race.registration_deadline)
    if (deadline < new Date()) {
      return { error: "Registration deadline has passed. You can no longer register for this race." }
    }
  }

  // ── Check race date hasn't passed ──
  if (new Date(race.date) < new Date()) {
    return { error: "This race has already taken place." }
  }

  // ── Conflict detection — check if any runner is already in this race ──
  const allRunnerIds = data.subTeamTypes.flatMap(st => data.runners[st] || [])

  const { data: existingRegistrations } = await supabase
    .from("registrations")
    .select("runners, team_id")
    .eq("race_id", data.raceId)

  if (existingRegistrations && existingRegistrations.length > 0) {
    for (const reg of existingRegistrations) {
      const registeredRunners: string[] = reg.runners || []
      const conflicts = allRunnerIds.filter(id => registeredRunners.includes(id))
      if (conflicts.length > 0) {
        // Get names of conflicting runners for a helpful error message
        const { data: conflictUsers } = await supabase
          .from("users")
          .select("first_name, last_name")
          .in("id", conflicts)
        const names = (conflictUsers || [])
          .map(u => `${u.first_name || ""} ${u.last_name || ""}`.trim())
          .join(", ")
        return { 
          error: `${names} ${conflicts.length === 1 ? "is" : "are"} already registered in this race with another team.` 
        }
      }
    }
  }


  for (const subTeamType of data.subTeamTypes) {
    const runners = data.runners[subTeamType] || []
    if (runners.length !== 10) {
      return { error: `${subTeamType.charAt(0).toUpperCase() + subTeamType.slice(1)} sub-team needs exactly 10 runners` }
    }
  }

  const { data: existingReg } = await supabase
    .from("registrations")
    .select("id")
    .eq("race_id", data.raceId)
    .eq("team_id", data.teamId)
    .single()

  if (existingReg) {
    return { error: "Your team is already registered for this race" }
  }

  // Calculate leg assignments based on ordered runners (or fall back to selection order)
  const legAssignments: Record<SubTeamType, Record<string, number[]>> = {} as Record<SubTeamType, Record<string, number[]>>
  for (const subTeamType of data.subTeamTypes) {
    const ordered = data.orderedRunners?.[subTeamType] || data.runners[subTeamType] || []
    legAssignments[subTeamType] = calculateLegAssignments(ordered)
  }

  const allRunners = data.subTeamTypes.flatMap(st => data.runners[st] || [])

  const { data: registration, error: regError } = await supabase
    .from("registrations")
    .insert({
      race_id: data.raceId,
      team_id: data.teamId,
      sub_team_type: data.subTeamTypes[0],
      sub_team_types: data.subTeamTypes,
      runners: allRunners,
      runners_by_subteam: data.runners,
      leg_assignments: legAssignments,
      payment_status: "pending",
      paid_amount: 0,
    })
    .select()
    .single()

  if (regError) {
    return { error: regError.message }
  }

  const { data: team } = await supabase.from("teams").select("manager_id, members, name").eq("id", data.teamId).single()

  if (team && race) {
    const subTeamNames = data.subTeamTypes.map(st => st.charAt(0).toUpperCase() + st.slice(1)).join(", ")

    await createNotification({
      userId: team.manager_id,
      type: "registration_success",
      title: "Race Registration Created",
      message: `Team "${team.name}" has been registered for "${race.title}" (${subTeamNames}). Payment is pending.`,
      metadata: {
        raceId: data.raceId,
        registrationId: registration.id,
        teamId: data.teamId,
      },
    })

    for (const runnerId of allRunners) {
      if (runnerId !== team.manager_id) {
        // Find which sub-team and legs this runner has
        let runnerLegs: number[] = []
        let runnerSubTeam = ""
        for (const st of data.subTeamTypes) {
          if (legAssignments[st]?.[runnerId]) {
            runnerLegs = legAssignments[st][runnerId]
            runnerSubTeam = st
            break
          }
        }

        await createNotification({
          userId: runnerId,
          type: "registration_success",
          title: "You're Registered for a Race!",
          message: `You've been registered for "${race.title}" with team "${team.name}". ${runnerLegs.length > 0 ? `You will run legs ${runnerLegs.join(", ")} in the ${runnerSubTeam} sub-team.` : ""}`,
          metadata: {
            raceId: data.raceId,
            registrationId: registration.id,
            teamId: data.teamId,
            legs: runnerLegs,
            subTeam: runnerSubTeam,
          },
        })
      }
    }
  }

  revalidatePath("/runner/races")
  revalidatePath("/runner/dashboard")
  revalidatePath("/manager/races")

  return { success: true, registrationId: registration.id }
}

export async function cancelRegistration(registrationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  const { data: registration } = await supabase
    .from("registrations")
    .select(`*, team:teams(*), race:races(*)`)
    .eq("id", registrationId)
    .single()

  if (!registration) {
    return { error: "Registration not found" }
  }

  const { data: userProfile } = await supabase.from("users").select("role").eq("id", user.id).single()

  const isManager = registration.team?.manager_id === user.id
  const isAdmin = userProfile?.role === "admin"

  if (!isManager && !isAdmin) {
    return { error: "Only team managers can cancel registrations" }
  }

  if (registration.payment_status === "paid") {
    return { error: "Cannot cancel a paid registration. Please contact support for refunds." }
  }

  const { error: deleteError } = await supabase.from("registrations").delete().eq("id", registrationId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  revalidatePath("/runner/races")
  revalidatePath("/runner/dashboard")
  revalidatePath("/manager/races")
  revalidatePath("/manager/dashboard")
  revalidatePath("/manager/registrations")

  return { success: true }
}

export async function getRaceDetails(raceId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.from("races").select("*").eq("id", raceId).single()

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function createRace(data: {
  title: string
  date: string
  venue: string
  start_location?: string | null
  end_location?: string | null
  waypoints?: string[]
  registration_deadline?: string
  registration_fee?: number
  details?: string
  rules?: string
}) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userProfile?.role !== "admin") {
    return { error: "Only admins can create races" }
  }

  const { data: race, error } = await supabase
    .from("races")
    .insert({
      title: data.title,
      date: data.date,
      venue: data.venue,
      start_location: data.start_location || null,
      end_location: data.end_location || null,
      waypoints: data.waypoints || [],
      registration_deadline: data.registration_deadline || null,
      registration_fee: data.registration_fee ?? 10,
      details: data.details || null,
      rules: data.rules || null,
      status: "upcoming",
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/admin/races")
  revalidatePath("/runner/races")
  revalidatePath("/manager/races")

  return { success: true, data: race }
}

export async function updateRace(
  raceId: string,
  data: {
    title?: string
    date?: string
    venue?: string
    start_location?: string | null
    end_location?: string | null
    waypoints?: string[]
    registration_deadline?: string
    registration_fee?: number
    details?: string
    rules?: string
    status?: "past" | "current" | "upcoming"
  }
) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userProfile?.role !== "admin") {
    return { error: "Only admins can update races" }
  }

  const { data: race, error } = await supabase
    .from("races")
    .update({
      ...data,
      waypoints: data.waypoints || [],
    })
    .eq("id", raceId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/admin/races")
  revalidatePath("/runner/races")
  revalidatePath("/manager/races")

  return { success: true, data: race }
}

export async function deleteRace(raceId: string) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userProfile?.role !== "admin") {
    return { error: "Only admins can delete races" }
  }

  const { data: registrations } = await supabase
    .from("registrations")
    .select("id")
    .eq("race_id", raceId)
    .limit(1)

  if (registrations && registrations.length > 0) {
    return { error: "Cannot delete race with existing registrations. Remove registrations first." }
  }

  const { error } = await supabase.from("races").delete().eq("id", raceId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/admin/races")
  revalidatePath("/runner/races")
  revalidatePath("/manager/races")

  return { success: true }
}