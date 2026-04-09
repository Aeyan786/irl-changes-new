"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Types
export interface Result {
  id: string
  race_id: string
  registration_id: string | null
  runner_id: string
  leg_times: number[]
  total_time: number
  finish_position: number | null
  notes: string | null
  created_at: string
}

export interface ResultWithDetails extends Result {
  runner?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  }
  race?: {
    id: string
    title: string
    date: string
    venue: string
  }
}

export interface CreateResultInput {
  race_id: string
  registration_id?: string | null
  runner_id: string
  leg_times?: number[]
  total_time: number
  finish_position?: number | null
  notes?: string | null
}

export interface UpdateResultInput {
  id: string
  leg_times?: number[]
  total_time?: number
  finish_position?: number | null
  notes?: string | null
}

// Get all results (admin only)
export async function getAllResults(): Promise<{
  results: ResultWithDetails[]
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("results")
    .select(`
      *,
      runner:users!results_runner_id_fkey(id, first_name, last_name, email),
      race:races!results_race_id_fkey(id, title, date, venue)
    `)
    .order("created_at", { ascending: false })

  if (error) {
    return { results: [], error: error.message }
  }

  return { results: data || [], error: null }
}

// Get results for a specific race
export async function getResultsByRace(raceId: string): Promise<{
  results: ResultWithDetails[]
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("results")
    .select(`
      *,
      runner:users!results_runner_id_fkey(id, first_name, last_name, email)
    `)
    .eq("race_id", raceId)
    .order("finish_position", { ascending: true, nullsFirst: false })
    .order("total_time", { ascending: true })

  if (error) {
    return { results: [], error: error.message }
  }

  return { results: data || [], error: null }
}

// Get results for a specific runner
export async function getResultsByRunner(runnerId: string): Promise<{
  results: ResultWithDetails[]
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("results")
    .select(`
      *,
      race:races!results_race_id_fkey(id, title, date, venue)
    `)
    .eq("runner_id", runnerId)
    .order("created_at", { ascending: false })

  if (error) {
    return { results: [], error: error.message }
  }

  return { results: data || [], error: null }
}

// Get a single result by ID
export async function getResultById(resultId: string): Promise<{
  result: ResultWithDetails | null
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("results")
    .select(`
      *,
      runner:users!results_runner_id_fkey(id, first_name, last_name, email),
      race:races!results_race_id_fkey(id, title, date, venue)
    `)
    .eq("id", resultId)
    .single()

  if (error) {
    return { result: null, error: error.message }
  }

  return { result: data, error: null }
}

// Create a new result (admin only)
export async function createResult(input: CreateResultInput): Promise<{
  result: Result | null
  error: string | null
}> {
  const supabase = await createClient()

  // Verify admin role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { result: null, error: "Unauthorized" }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "admin") {
    return { result: null, error: "Only admins can create results" }
  }

  const { data, error } = await supabase
    .from("results")
    .insert({
      race_id: input.race_id,
      registration_id: input.registration_id || null,
      runner_id: input.runner_id,
      leg_times: input.leg_times || [],
      total_time: input.total_time,
      finish_position: input.finish_position || null,
      notes: input.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { result: null, error: error.message }
  }

  revalidatePath("/admin/results")
  revalidatePath("/runner/results")
  revalidatePath("/manager/results")

  return { result: data, error: null }
}

// Update an existing result (admin only)
export async function updateResult(input: UpdateResultInput): Promise<{
  result: Result | null
  error: string | null
}> {
  const supabase = await createClient()

  // Verify admin role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { result: null, error: "Unauthorized" }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "admin") {
    return { result: null, error: "Only admins can update results" }
  }

  const updateData: Partial<Result> = {}
  if (input.leg_times !== undefined) updateData.leg_times = input.leg_times
  if (input.total_time !== undefined) updateData.total_time = input.total_time
  if (input.finish_position !== undefined) updateData.finish_position = input.finish_position
  if (input.notes !== undefined) updateData.notes = input.notes

  const { data, error } = await supabase
    .from("results")
    .update(updateData)
    .eq("id", input.id)
    .select()
    .single()

  if (error) {
    return { result: null, error: error.message }
  }

  revalidatePath("/admin/results")
  revalidatePath("/runner/results")
  revalidatePath("/manager/results")

  return { result: data, error: null }
}

// Delete a result (admin only)
export async function deleteResult(resultId: string): Promise<{
  success: boolean
  error: string | null
}> {
  const supabase = await createClient()

  // Verify admin role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Unauthorized" }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "admin") {
    return { success: false, error: "Only admins can delete results" }
  }

  const { error } = await supabase
    .from("results")
    .delete()
    .eq("id", resultId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/results")
  revalidatePath("/runner/results")
  revalidatePath("/manager/results")

  return { success: true, error: null }
}

// Bulk create results for a race (admin only)
export async function bulkCreateResults(
  raceId: string,
  results: Omit<CreateResultInput, "race_id">[]
): Promise<{
  results: Result[]
  error: string | null
}> {
  const supabase = await createClient()

  // Verify admin role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { results: [], error: "Unauthorized" }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "admin") {
    return { results: [], error: "Only admins can create results" }
  }

  const resultsToInsert = results.map((r) => ({
    race_id: raceId,
    registration_id: r.registration_id || null,
    runner_id: r.runner_id,
    leg_times: r.leg_times || [],
    total_time: r.total_time,
    finish_position: r.finish_position || null,
    notes: r.notes || null,
  }))

  const { data, error } = await supabase
    .from("results")
    .insert(resultsToInsert)
    .select()

  if (error) {
    return { results: [], error: error.message }
  }

  revalidatePath("/admin/results")
  revalidatePath("/runner/results")
  revalidatePath("/manager/results")

  return { results: data || [], error: null }
}

// Get race leaderboard using the database function
export async function getRaceLeaderboard(raceId: string): Promise<{
  leaderboard: Array<{
    id: string
    runner_id: string
    runner_first_name: string | null
    runner_last_name: string | null
    runner_email: string
    leg_times: number[]
    total_time: number
    finish_position: number | null
    notes: string | null
  }>
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("get_race_leaderboard", {
    p_race_id: raceId,
  })

  if (error) {
    return { leaderboard: [], error: error.message }
  }

  return { leaderboard: data || [], error: null }
}

// Get runner's race history using the database function
export async function getRunnerRaceHistory(runnerId: string): Promise<{
  history: Array<{
    id: string
    race_id: string
    race_title: string
    race_date: string
    race_venue: string
    leg_times: number[]
    total_time: number
    finish_position: number | null
    notes: string | null
    created_at: string
  }>
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("get_runner_results", {
    p_runner_id: runnerId,
  })

  if (error) {
    return { history: [], error: error.message }
  }

  return { history: data || [], error: null }
}

// Helper function to format time in HH:MM:SS
export async function formatTime(totalSeconds: number): Promise<string> {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

// Helper function to parse time string to seconds
export async function parseTimeToSeconds(timeString: string): Promise<number> {
  const parts = timeString.split(":").map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return parts[0] || 0
}
