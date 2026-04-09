"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"

/**
 * Assign a team member as assistant manager.
 * Creates a pending invitation instead of instantly assigning.
 */
export async function assignAssistantManager(teamId: string, userId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, manager_id, members")
    .eq("id", teamId)
    .single()

  if (teamError || !team) {
    return { error: "Team not found" }
  }

  if (team.manager_id !== user.id) {
    return { error: "Only the team manager can assign assistant managers" }
  }

  if (userId === user.id) {
    return { error: "You cannot assign yourself as assistant manager" }
  }

  if (!team.members?.includes(userId)) {
    return { error: "User must be a team member to be assigned as assistant manager" }
  }

  // Check if already an AM for this team
  const { data: existingAM } = await supabase
    .from("assistant_managers")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single()

  if (existingAM) {
    return { error: "This runner is already an assistant manager for this team" }
  }

  // Check if there's already a pending AM invitation
  const { data: existingInvite } = await supabase
    .from("invitations")
    .select("id")
    .eq("team_id", teamId)
    .eq("to_user_id", userId)
    .eq("type", "am_assignment")
    .eq("status", "pending")
    .single()

  if (existingInvite) {
    return { error: "There is already a pending assistant manager invitation for this runner" }
  }

  // Create pending AM invitation
  const { error: inviteError } = await supabase
    .from("invitations")
    .insert({
      from_user_id: user.id,
      to_user_id: userId,
      team_id: teamId,
      type: "am_assignment",
      status: "pending",
    })

  if (inviteError) {
    return { error: inviteError.message }
  }

  // Get assigned user details for notification
  const { data: assignedUser } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", userId)
    .single()

  const name = `${assignedUser?.first_name || ""} ${assignedUser?.last_name || ""}`.trim()

  // Notify the runner
  await createNotification({
    userId,
    type: "team_update",
    title: "Assistant Manager Invitation",
    message: `You have been invited to become Assistant Manager for team "${team.name}". Check your invitations to accept or decline.`,
    metadata: { teamId, assignedBy: user.id },
  })

  revalidatePath("/manager/teams")
  revalidatePath("/runner/invitations")

  return { success: true, name }
}

/**
 * Runner accepts an AM invitation.
 */
export async function acceptAmInvitation(invitationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  // Get invitation details
  const { data: invitation, error: inviteError } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name, manager_id),
      from_user:users!invitations_from_user_id_fkey(id, first_name, last_name)
    `)
    .eq("id", invitationId)
    .eq("type", "am_assignment")
    .eq("to_user_id", user.id)
    .single()

  if (inviteError || !invitation) {
    return { error: "Invitation not found" }
  }

  if (invitation.status !== "pending") {
    return { error: "This invitation has already been processed" }
  }

  // Update invitation status
  const { error: updateError } = await supabase
    .from("invitations")
    .update({ status: "accepted" })
    .eq("id", invitationId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Run the assign_assistant_manager RPC
  const { data: result, error: rpcError } = await supabase.rpc(
    "assign_assistant_manager",
    {
      p_team_id: invitation.team_id,
      p_user_id: user.id,
      p_manager_id: invitation.from_user_id,
    }
  )

  if (rpcError) {
    return { error: rpcError.message }
  }

  if (result?.error) {
    return { error: result.error }
  }

  // Notify the manager
  if (invitation.team?.manager_id) {
    const { data: userProfile } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single()

    await createNotification({
      userId: invitation.team.manager_id,
      type: "invitation_accepted",
      title: "Assistant Manager Role Accepted",
      message: `${userProfile?.first_name || "A runner"} ${userProfile?.last_name || ""} has accepted the assistant manager role for team "${invitation.team.name}".`,
      metadata: { teamId: invitation.team_id, invitationId },
    })
  }

  revalidatePath("/runner/invitations")
  revalidatePath("/manager/teams")

  return { success: true, teamName: invitation.team?.name }
}

/**
 * Runner rejects an AM invitation.
 */
export async function rejectAmInvitation(invitationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  const { data: invitation, error: inviteError } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name, manager_id)
    `)
    .eq("id", invitationId)
    .eq("type", "am_assignment")
    .eq("to_user_id", user.id)
    .single()

  if (inviteError || !invitation) {
    return { error: "Invitation not found" }
  }

  if (invitation.status !== "pending") {
    return { error: "This invitation has already been processed" }
  }

  const { error: updateError } = await supabase
    .from("invitations")
    .update({ status: "rejected" })
    .eq("id", invitationId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Notify the manager
  if (invitation.team?.manager_id) {
    const { data: userProfile } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single()

    await createNotification({
      userId: invitation.team.manager_id,
      type: "invitation_rejected",
      title: "Assistant Manager Role Declined",
      message: `${userProfile?.first_name || "A runner"} ${userProfile?.last_name || ""} has declined the assistant manager role for team "${invitation.team.name}".`,
      metadata: { teamId: invitation.team_id, invitationId },
    })
  }

  revalidatePath("/runner/invitations")
  revalidatePath("/manager/teams")

  return { success: true }
}

/**
 * Allow an AM to resign their own role.
 */
export async function resignAssistantManagerRole(teamId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, manager_id")
    .eq("id", teamId)
    .single()

  if (!team) {
    return { error: "Team not found" }
  }

  const { data: result, error: rpcError } = await supabase.rpc(
    "remove_assistant_manager",
    {
      p_team_id: teamId,
      p_user_id: user.id,
      p_manager_id: team.manager_id,
    }
  )

  if (rpcError) {
    return { error: rpcError.message }
  }

  if (result?.error) {
    return { error: result.error }
  }

  await createNotification({
    userId: team.manager_id,
    type: "team_update",
    title: "Assistant Manager Resigned",
    message: `Your assistant manager has stepped down from the role in team "${team.name}".`,
    metadata: { teamId },
  })

  revalidatePath("/manager/teams")
  revalidatePath("/runner/dashboard")

  return { success: true }
}

/**
 * Remove a user's assistant manager role from a team.
 * Only the team's main manager can do this.
 */
export async function removeAssistantManager(teamId: string, userId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, manager_id")
    .eq("id", teamId)
    .single()

  if (teamError || !team) {
    return { error: "Team not found" }
  }

  if (team.manager_id !== user.id) {
    return { error: "Only the team manager can remove assistant managers" }
  }

  const { data: result, error: rpcError } = await supabase.rpc(
    "remove_assistant_manager",
    {
      p_team_id: teamId,
      p_user_id: userId,
      p_manager_id: user.id,
    }
  )

  if (rpcError) {
    return { error: rpcError.message }
  }

  if (result?.error) {
    return { error: result.error }
  }

  const { data: removedUser } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", userId)
    .single()

  const name = `${removedUser?.first_name || ""} ${removedUser?.last_name || ""}`.trim()

  await createNotification({
    userId,
    type: "team_update",
    title: "Assistant Manager Role Removed",
    message: `Your assistant manager role for team "${team.name}" has been removed.`,
    metadata: { teamId },
  })

  revalidatePath("/manager/teams")
  revalidatePath("/manager/dashboard")

  return { success: true, name }
}

/**
 * Get all assistant managers for a team.
 */
export async function getAssistantManagers(teamId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("assistant_managers")
    .select(`
      id,
      user_id,
      assigned_by,
      created_at,
      user:users!assistant_managers_user_id_fkey(
        id, first_name, last_name, email, gender
      )
    `)
    .eq("team_id", teamId)

  if (error) {
    return { error: error.message }
  }

  return { data }
}

/**
 * Get the team where the current user is an assistant manager.
 */
export async function getAssistantManagerTeam() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  const { data, error } = await supabase
    .from("assistant_managers")
    .select(`
      id,
      team_id,
      assigned_by,
      created_at,
      team:teams!assistant_managers_team_id_fkey(
        id, name, manager_id, members, details, is_high_school, types, created_at,
        manager:users!teams_manager_id_fkey(id, first_name, last_name, email)
      )
    `)
    .eq("user_id", user.id)
    .single()

  if (error) {
    return { data: null }
  }

  return { data }
}

/**
 * Assistant manager adds a runner to their team.
 */
export async function assistantManagerAddRunner(teamId: string, runnerEmail: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  const { data: amRecord } = await supabase
    .from("assistant_managers")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single()

  if (!amRecord) {
    return { error: "You are not an assistant manager for this team" }
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, manager_id, members")
    .eq("id", teamId)
    .single()

  if (!team) {
    return { error: "Team not found" }
  }

  const { data: runner } = await supabase
    .from("users")
    .select("id, first_name, last_name, email, current_team_id")
    .eq("email", runnerEmail.toLowerCase().trim())
    .single()

  if (!runner) {
    return { error: "No user found with that email" }
  }

  if (runner.current_team_id) {
    return { error: "This runner is already in a team" }
  }

  if (team.members?.includes(runner.id)) {
    return { error: "This runner is already a member of this team" }
  }

  const maxRunners = 10
  if ((team.members?.length || 0) >= maxRunners) {
    return { error: `Team is full (max ${maxRunners} runners)` }
  }

  const { error: addError } = await supabase.rpc("add_team_member", {
    p_team_id: teamId,
    p_user_id: runner.id,
  })

  if (addError) {
    return { error: addError.message }
  }

  await createNotification({
    userId: runner.id,
    type: "team_update",
    title: "Added to Team",
    message: `You have been added to team "${team.name}".`,
    metadata: { teamId },
  })

  revalidatePath("/manager/teams")
  revalidatePath("/assistant-manager/dashboard")

  return {
    success: true,
    name: `${runner.first_name || ""} ${runner.last_name || ""}`.trim(),
  }
}

/**
 * Assistant manager removes a runner from their team.
 */
export async function assistantManagerRemoveRunner(teamId: string, runnerId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  const { data: amRecord } = await supabase
    .from("assistant_managers")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single()

  if (!amRecord) {
    return { error: "You are not an assistant manager for this team" }
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, manager_id")
    .eq("id", teamId)
    .single()

  if (!team) {
    return { error: "Team not found" }
  }

  if (runnerId === team.manager_id) {
    return { error: "Cannot remove the team manager" }
  }

  const { error: removeError } = await supabase.rpc("remove_team_member", {
    p_team_id: teamId,
    p_user_id: runnerId,
  })

  if (removeError) {
    return { error: removeError.message }
  }

  const { data: removedUser } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", runnerId)
    .single()

  await createNotification({
    userId: runnerId,
    type: "team_update",
    title: "Removed from Team",
    message: `You have been removed from team "${team.name}".`,
    metadata: { teamId },
  })

  revalidatePath("/manager/teams")
  revalidatePath("/assistant-manager/dashboard")

  return {
    success: true,
    name: `${removedUser?.first_name || ""} ${removedUser?.last_name || ""}`.trim(),
  }
}