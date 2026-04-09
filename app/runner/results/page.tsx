import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ResultsClient } from "./results-client"

export type RaceResult = {
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
}

export type TeamInfo = {
  id: string
  name: string
}

async function getResultsPageData() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  // Get user's results with race details
  const { data: results, error: resultsError } = await supabase
    .from("results")
    .select(`
      *,
      race:races!results_race_id_fkey(id, title, date, venue)
    `)
    .eq("runner_id", user.id)
    .order("created_at", { ascending: false })

  // Transform results to include race details
  const transformedResults: RaceResult[] = (results || []).map((result) => ({
    id: result.id,
    race_id: result.race_id,
    race_title: result.race?.title || "Unknown Race",
    race_date: result.race?.date || "",
    race_venue: result.race?.venue || "",
    leg_times: result.leg_times || [],
    total_time: result.total_time,
    finish_position: result.finish_position,
    notes: result.notes,
    created_at: result.created_at,
  }))

  // Get user's teams for context
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .or(`manager_id.eq.${user.id},members.cs.{${user.id}}`)

  // Get registrations to link results to teams
  let teamRegistrations: Record<string, string> = {}
  if (teams && teams.length > 0) {
    const teamIds = teams.map((t) => t.id)
    const { data: registrations } = await supabase
      .from("registrations")
      .select("race_id, team_id")
      .in("team_id", teamIds)

    if (registrations) {
      for (const reg of registrations) {
        teamRegistrations[reg.race_id] = reg.team_id
      }
    }
  }

  return {
    userId: user.id,
    results: transformedResults,
    teams: (teams || []) as TeamInfo[],
    teamRegistrations,
    hasError: !!resultsError,
  }
}

export default async function RunnerResultsPage() {
  const data = await getResultsPageData()
  return <ResultsClient {...data} />
}
