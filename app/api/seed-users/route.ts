"use server"

import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// This route creates test users using Supabase Admin API
// Only run this once in development

export async function POST(request: Request) {
  // Verify secret to prevent unauthorized access
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get("secret")
  
  if (secret !== "irl-seed-2024") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing Supabase credentials" },
      { status: 500 }
    )
  }

  // Create admin client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const testUsers = [
    {
      email: "runner@irl.com",
      password: "Runner123!",
      role: "runner",
      first_name: "John",
      last_name: "Runner",
      address: {
        street: "123 Marathon Lane",
        city: "Boston",
        state: "MA",
        zip_code: "02101",
      },
      age: 28,
      gender: "male",
      past_achievements: "Boston Marathon 2023 - 3:15:00\n5K Personal Best - 18:30",
      disabilities: null,
    },
    {
      email: "manager@irl.com",
      password: "Manager123!",
      role: "manager",
      first_name: "Sarah",
      last_name: "Manager",
      address: {
        street: "456 Coach Street",
        city: "New York",
        state: "NY",
        zip_code: "10001",
      },
      age: 35,
      gender: "female",
      past_achievements: null,
      disabilities: null,
    },
    {
      email: "admin@irl.com",
      password: "Admin123!",
      role: "admin",
      first_name: "Admin",
      last_name: "User",
      address: {
        street: "789 Admin Ave",
        city: "Chicago",
        state: "IL",
        zip_code: "60601",
      },
      age: 40,
      gender: "male",
      past_achievements: null,
      disabilities: null,
    },
  ]

  const results = []

  for (const user of testUsers) {
    try {
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === user.email)

      if (existingUser) {
        results.push({ email: user.email, status: "already exists" })
        continue
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Auto-confirm email for test users
        user_metadata: {
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          address: user.address,
          age: user.age,
          gender: user.gender,
          past_achievements: user.past_achievements,
          disabilities: user.disabilities,
        },
      })

      if (authError) {
        results.push({ email: user.email, status: "error", error: authError.message })
        continue
      }

      // The trigger should create the user in public.users, but let's ensure it exists
      if (authData.user) {
        const { error: upsertError } = await supabase.from("users").upsert({
          id: authData.user.id,
          email: user.email,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          address: user.address,
          age: user.age,
          gender: user.gender,
          past_achievements: user.past_achievements,
          disabilities: user.disabilities,
        }, { onConflict: "id" })

        if (upsertError) {
          results.push({ email: user.email, status: "auth created, db error", error: upsertError.message })
        } else {
          results.push({ email: user.email, status: "created successfully" })
        }
      }
    } catch (err) {
      results.push({ email: user.email, status: "exception", error: String(err) })
    }
  }

  // Create sample team for manager
  const managerResult = results.find(r => r.email === "manager@irl.com")
  if (managerResult?.status === "created successfully" || managerResult?.status === "already exists") {
    const { data: manager } = await supabase
      .from("users")
      .select("id")
      .eq("email", "manager@irl.com")
      .single()

    if (manager) {
      // Check if team already exists
      const { data: existingTeam } = await supabase
        .from("teams")
        .select("id")
        .eq("name", "Boston Blazers")
        .single()

      let teamId = existingTeam?.id

      if (!existingTeam) {
        // Create team if it doesn't exist
        const { data: newTeam, error: teamError } = await supabase
          .from("teams")
          .insert({
            name: "Boston Blazers",
            manager_id: manager.id,
          })
          .select("id")
          .single()

        if (!teamError && newTeam) {
          teamId = newTeam.id
        }
      }

      if (teamId) {
        // Add runner to team
        const { data: runner } = await supabase
          .from("users")
          .select("id")
          .eq("email", "runner@irl.com")
          .single()

        if (runner) {
          // Check if team member already exists
          const { data: existingMember } = await supabase
            .from("team_members")
            .select("id")
            .eq("team_id", teamId)
            .eq("user_id", runner.id)
            .single()

          if (!existingMember) {
            await supabase.from("team_members").insert({
              team_id: teamId,
              user_id: runner.id,
            })
          }
        }
      }
    }
  }

  // Create sample races (only if they don't already exist)
  const races = [
    {
      title: "Spring Marathon 2024",
      date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      venue: "Central Park, New York",
      details: "Annual spring marathon through Central Park. Full marathon distance of 26.2 miles.",
      rules: "1. All runners must be 18+\n2. Bib numbers must be visible\n3. No headphones allowed\n4. Cutoff time: 6 hours",
      status: "upcoming",
    },
    {
      title: "Summer 10K Challenge",
      date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days from now
      venue: "Lakefront Trail, Chicago",
      details: "A scenic 10K run along the beautiful Chicago lakefront.",
      rules: "1. All runners must be 18+\n2. Water stations every 2 miles\n3. Chip timing required",
      status: "upcoming",
    },
    {
      title: "Winter Half Marathon 2024",
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      venue: "Freedom Trail, Boston",
      details: "Historic half marathon through Boston's Freedom Trail.",
      rules: "1. All runners must be 18+\n2. Cold weather gear recommended",
      status: "past",
    },
  ]

  for (const race of races) {
    // Check if race with this title already exists
    const { data: existingRace } = await supabase
      .from("races")
      .select("id")
      .eq("title", race.title)
      .single()

    if (!existingRace) {
      await supabase.from("races").insert(race)
    }
  }

  return NextResponse.json({
    message: "Seed complete",
    results,
    testCredentials: [
      { role: "Runner", email: "runner@irl.com", password: "Runner123!" },
      { role: "Manager", email: "manager@irl.com", password: "Manager123!" },
      { role: "Admin", email: "admin@irl.com", password: "Admin123!" },
    ],
  })
}
