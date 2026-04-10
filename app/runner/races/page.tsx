import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RacesClient } from "./races-client";

export type Race = {
  id: string;
  title: string;
  date: string;
  venue: string;
  start_location: string | null;
  end_location: string | null;
  waypoints: string[] | null;
  registration_deadline: string | null;
  details: string | null;
  rules: string | null;
  status: "past" | "current" | "upcoming";
  created_at: string;
};

export type Registration = {
  id: string;
  race_id: string;
  team_id: string;
  sub_team_type: "male" | "female" | "co-ed";
  sub_team_types?: ("male" | "female" | "co-ed")[];
  runners: string[];
  payment_status: "pending" | "paid" | "failed";
};

export type Team = {
  id: string;
  name: string;
  manager_id: string;
  members: string[];
};

export type TeamMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

async function getRacesPageData() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/login");
  }

  // Get all races
  const { data: allRaces } = await supabase
    .from("races")
    .select("*")
    .order("date", { ascending: true });

  const now = new Date();

  const racesWithStatus = (allRaces || []).map((race) => {
    const raceDate = new Date(race.date);
    const deadline = race.registration_deadline
      ? new Date(race.registration_deadline)
      : null;

    let status: "upcoming" | "current" | "past" = race.status;

    if (raceDate < now) status = "past";
    else if (deadline && deadline <= now) status = "current";
    else status = "upcoming";

    return { ...race, status };
  });

  const upcomingRaces = racesWithStatus.filter((r) => r.status === "upcoming");
  const currentRaces = racesWithStatus.filter((r) => r.status === "current");
  const pastRaces = racesWithStatus.filter((r) => r.status === "past");

  // Get user's teams
  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .or(`manager_id.eq.${user.id},members.cs.{${user.id}}`);

  // Get registrations for user's teams
  let registrations: Registration[] = [];
  if (teams && teams.length > 0) {
    const teamIds = teams.map((t) => t.id);
    const { data: regs } = await supabase
      .from("registrations")
      .select("*")
      .in("team_id", teamIds);

    registrations = (regs || []) as Registration[];
  }

  // Get team members for teams the user is part of
  let teamMembers: TeamMember[] = [];
  if (teams && teams.length > 0) {
    const allMemberIds = new Set<string>();
    for (const team of teams) {
      allMemberIds.add(team.manager_id);
      if (team.members) {
        for (const memberId of team.members) {
          allMemberIds.add(memberId);
        }
      }
    }

    if (allMemberIds.size > 0) {
      const { data: members } = await supabase
        .from("users")
        .select("id, first_name, last_name, email")
        .in("id", Array.from(allMemberIds));

      teamMembers = (members || []) as TeamMember[];
    }
  }

  return {
    userId: user.id,
    currentRaces: currentRaces as Race[],
    upcomingRaces: upcomingRaces as Race[],
    pastRaces: pastRaces as Race[],
    teams: (teams || []) as Team[],
    registrations,
    teamMembers,
  };
}

export default async function RunnerRacesPage() {
  const data = await getRacesPageData();
  return <RacesClient {...data} />;
}
