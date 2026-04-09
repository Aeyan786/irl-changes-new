"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"
import { sendInvitationAcceptedEmail } from "@/lib/email"

export async function createTeam(formData: {
  name: string
  description?: string
  is_high_school?: boolean
  logo_url?: string | null
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  // Verify user is a manager
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "manager") {
    return { error: "Only managers can create teams" }
  }

  // Check if manager already has a team
  const { data: existingTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("manager_id", user.id)
    .single()

  if (existingTeam) {
    return { error: "You already have a team. Managers can only have one team." }
  }

  // Create the team
  const { data: newTeam, error: createError } = await supabase
    .from("teams")
    .insert({
      name: formData.name,
      manager_id: user.id,
      members: [],
      details: formData.description || null,
      is_high_school: formData.is_high_school || false,
      logo_url: formData.logo_url || null,
    })
    .select()
    .single()

  if (createError) {
    return { error: createError.message }
  }

  revalidatePath("/manager/teams")
  revalidatePath("/manager/dashboard")

  return { success: true, team: newTeam }
}

export async function updateTeam(
  teamId: string,
  formData: {
    name?: string
    details?: string
    is_high_school?: boolean
    logo_url?: string | null
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  // Get team and verify ownership
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single()

  if (teamError || !team) {
    return { error: "Team not found" }
  }

  if (team.manager_id !== user.id) {
    return { error: "Only the team manager can update the team" }
  }

  // Update team
  const updateData: Record<string, string | boolean | null> = {}
  if (formData.name !== undefined) updateData.name = formData.name.trim()
  if (formData.details !== undefined) updateData.details = formData.details.trim() || null
  if (formData.is_high_school !== undefined) updateData.is_high_school = formData.is_high_school
  if (formData.logo_url !== undefined) updateData.logo_url = formData.logo_url ?? null
  if (formData.logo_url !== undefined) updateData.logo_url = formData.logo_url ?? null

  const { error: updateError } = await supabase
    .from("teams")
    .update(updateData)
    .eq("id", teamId)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath("/manager/teams")
  revalidatePath("/manager/dashboard")

  return { success: true }
}

export async function deleteTeam(teamId: string) {
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
    .select("*")
    .eq("id", teamId)
    .single()

  if (teamError || !team) {
    return { error: "Team not found" }
  }

  if (team.manager_id !== user.id) {
    return { error: "Only the team manager can delete the team" }
  }

  // Use admin client to bypass RLS for AM operations
  const { createClient: createAdminClient } = await import("@supabase/supabase-js")
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get all AMs for this team using admin client
  const { data: assistantManagers } = await admin
    .from("assistant_managers")
    .select("user_id")
    .eq("team_id", teamId)

  // Also catch any members with assistant_manager role
  const allMemberIds = team.members || []
  const { data: amMembers } = await admin
    .from("users")
    .select("id")
    .in("id", allMemberIds)
    .eq("role", "assistant_manager")

  const amUserIds = [
    ...new Set([
      ...(assistantManagers?.map((am) => am.user_id) || []),
      ...(amMembers?.map((m) => m.id) || []),
    ])
  ]

  if (amUserIds.length > 0) {
    const { error: rpcError } = await admin.rpc("revert_am_roles_to_runner", { user_ids: amUserIds })
    console.log("RPC revert result:", rpcError, "userIds:", amUserIds)

    await admin
      .from("assistant_managers")
      .delete()
      .eq("team_id", teamId)

    for (const amUserId of amUserIds) {
      await createNotification({
        userId: amUserId,
        type: "team_update",
        title: "Assistant Manager Role Removed",
        message: `Team "${team.name}" has been deleted. Your assistant manager role has been removed and you are now a runner again.`,
        metadata: { teamId },
      })
    }
  }

  // Clear current_team_id for all members
  if (team.members && team.members.length > 0) {
    await supabase
      .from("users")
      .update({ current_team_id: null })
      .in("id", team.members)
  }

  // Delete related invitations
  await supabase
    .from("invitations")
    .delete()
    .eq("team_id", teamId)

  // Delete the team
  const { error: deleteError } = await supabase
    .from("teams")
    .delete()
    .eq("id", teamId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  // Notify members
  for (const memberId of team.members || []) {
    await createNotification({
      userId: memberId,
      type: "team_update",
      title: "Team Deleted",
      message: `The team "${team.name}" has been deleted by the manager.`,
      metadata: { teamId },
    })
  }

  revalidatePath("/manager/teams")
  revalidatePath("/manager/dashboard")
  revalidatePath("/runner/teams")
  revalidatePath("/runner/dashboard")

  return { success: true, teamName: team.name }
}

export async function removeTeamMember(teamId: string, memberId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  // Get team details and verify ownership
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single()

  if (teamError || !team) {
    return { error: "Team not found" }
  }

  // Verify user is the team manager
  if (team.manager_id !== user.id) {
    return { error: "Only the team manager can remove members" }
  }

  // Remove member from team using RPC
  const { error: removeError } = await supabase.rpc("remove_team_member", {
    p_team_id: teamId,
    p_user_id: memberId,
  })

  if (removeError) {
    return { error: removeError.message }
  }

  // Get removed member details for notification
  const { data: removedUser } = await supabase
    .from("users")
    .select("first_name, last_name, email")
    .eq("id", memberId)
    .single()

  // Notify the removed member
  await createNotification({
    userId: memberId,
    type: "team_update",
    title: "Removed from Team",
    message: `You have been removed from team "${team.name}".`,
    metadata: {
      teamId,
    },
  })

  revalidatePath("/manager/teams")
  revalidatePath("/runner/teams")
  revalidatePath("/runner/dashboard")

  return { success: true, memberName: `${removedUser?.first_name || ""} ${removedUser?.last_name || ""}`.trim() }
}

export async function acceptTeamInvitation(invitationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  // Check if user is already in a team
  const { data: currentUser } = await supabase
    .from("users")
    .select("email, current_team_id")
    .eq("id", user.id)
    .single()

  if (currentUser?.current_team_id) {
    return { error: "You are already in a team. Leave your current team first before joining another." }
  }

  // Get invitation details
  const { data: invitation, error: inviteError } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name, manager_id),
      from_user:users!invitations_from_user_id_fkey(id, email, first_name, last_name)
    `)
    .eq("id", invitationId)
    .single()

  if (inviteError || !invitation) {
    return { error: "Invitation not found" }
  }

  // Verify user is the recipient
  const isLinkInvite = invitation.to_email?.includes("@placeholder.local")

  if (
    !isLinkInvite &&
    invitation.to_user_id !== user.id &&
    invitation.to_email?.toLowerCase() !== currentUser?.email?.toLowerCase()
  ) {
    return { error: "You are not authorized to accept this invitation" }
  }

  if (invitation.status !== "pending") {
    return { error: "This invitation has already been processed" }
  }

  // Update invitation status
  const { error: updateError } = await supabase
    .from("invitations")
    .update({ status: "accepted", to_user_id: user.id })
    .eq("id", invitationId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Add user to team members
  const { error: teamError } = await supabase.rpc("add_team_member", {
    p_team_id: invitation.team_id,
    p_user_id: user.id,
  })

  if (teamError) {
    return { error: teamError.message }
  }

  // Get user details for notification
  const { data: userProfile } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single()

  // Notify the manager
  if (invitation.team?.manager_id) {
    await createNotification({
      userId: invitation.team.manager_id,
      type: "invitation_accepted",
      title: "Team Invitation Accepted",
      message: `${userProfile?.first_name || "A runner"} ${userProfile?.last_name || ""} has joined your team "${invitation.team.name}".`,
      metadata: {
        teamId: invitation.team_id,
        invitationId,
        userId: user.id,
      },
    })

    // Send email to manager
    if (invitation.from_user?.email) {
      const managerName = `${invitation.from_user.first_name || ""} ${invitation.from_user.last_name || ""}`.trim() || "Manager"
      const runnerName = `${userProfile?.first_name || ""} ${userProfile?.last_name || ""}`.trim() || "A runner"
      await sendInvitationAcceptedEmail(
        invitation.from_user.email,
        managerName,
        runnerName,
        invitation.team.name
      )
    }
  }

  revalidatePath("/runner/teams")
  revalidatePath("/runner/dashboard")
  revalidatePath("/runner/invitations")
  revalidatePath("/manager/teams")
  revalidatePath("/manager/invitations")

  return { success: true, teamName: invitation.team?.name }
}

export async function rejectTeamInvitation(invitationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  // Get invitation details
  const { data: invitation } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name, manager_id)
    `)
    .eq("id", invitationId)
    .single()

  if (!invitation) {
    return { error: "Invitation not found" }
  }

  // Update invitation status
  const { error: updateError } = await supabase
    .from("invitations")
    .update({ status: "rejected" })
    .eq("id", invitationId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Get user details for notification
  const { data: userProfile } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single()

  // Notify the manager
  if (invitation.team?.manager_id) {
    await createNotification({
      userId: invitation.team.manager_id,
      type: "invitation_rejected",
      title: "Team Invitation Declined",
      message: `${userProfile?.first_name || "A runner"} ${userProfile?.last_name || ""} has declined your invitation to join "${invitation.team.name}".`,
      metadata: {
        teamId: invitation.team_id,
        invitationId,
      },
    })
  }

  revalidatePath("/runner/teams")
  revalidatePath("/manager/teams")

  return { success: true }
}

export async function requestToJoinTeam(teamId: string, message?: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  // Check if user is already in a team
  const { data: currentUser } = await supabase
    .from("users")
    .select("current_team_id")
    .eq("id", user.id)
    .single()

  if (currentUser?.current_team_id) {
    return { error: "You are already in a team. Leave your current team first before requesting to join another." }
  }

  // Get team details
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select(`
      *,
      manager:users!teams_manager_id_fkey(id, email, first_name, last_name)
    `)
    .eq("id", teamId)
    .single()

  if (teamError || !team) {
    return { error: "Team not found" }
  }

  // Check if user is already a member
  if (team.members?.includes(user.id) || team.manager_id === user.id) {
    return { error: "You are already a member of this team" }
  }

  // Check if there's already a pending request
  const { data: existingRequest } = await supabase
    .from("invitations")
    .select("id")
    .eq("from_user_id", user.id)
    .eq("team_id", teamId)
    .eq("status", "pending")
    .eq("type", "team_join")
    .single()

  if (existingRequest) {
    return { error: "You already have a pending request for this team" }
  }

  // Get user details
  const { data: userProfile } = await supabase
    .from("users")
    .select("email, first_name, last_name")
    .eq("id", user.id)
    .single()

  // Create join request invitation (from runner to manager)
  const { error: inviteError } = await supabase.from("invitations").insert({
    from_user_id: user.id,
    to_user_id: team.manager_id,
    team_id: teamId,
    type: "team_join",
    status: "pending",
  })

  if (inviteError) {
    return { error: inviteError.message }
  }

  // Notify the manager
  await createNotification({
    userId: team.manager_id,
    type: "invitation_received",
    title: "Team Join Request",
    message: `${userProfile?.first_name || "A runner"} ${userProfile?.last_name || ""} has requested to join your team "${team.name}".${message ? ` Message: "${message}"` : ""}`,
    metadata: {
      teamId,
      requesterId: user.id,
    },
  })

  revalidatePath("/runner/teams")
  revalidatePath("/manager/teams")

  return { success: true, teamName: team.name }
}

export async function acceptJoinRequest(invitationId: string) {
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
      from_user:users!invitations_from_user_id_fkey(id, email, first_name, last_name, current_team_id)
    `)
    .eq("id", invitationId)
    .single()

  if (inviteError || !invitation) {
    return { error: "Request not found" }
  }

  // Verify user is the team manager
  if (invitation.team?.manager_id !== user.id) {
    return { error: "You are not authorized to accept this request" }
  }

  if (invitation.status !== "pending") {
    return { error: "This request has already been processed" }
  }

  // Check if the requester is already in a team
  if (invitation.from_user?.current_team_id) {
    await supabase
      .from("invitations")
      .update({ status: "rejected" })
      .eq("id", invitationId)

    return { error: "This runner has already joined another team. The request has been automatically declined." }
  }

  // Update invitation status
  const { error: updateError } = await supabase
    .from("invitations")
    .update({ status: "accepted" })
    .eq("id", invitationId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Add requester to team members
  const { error: teamError } = await supabase.rpc("add_team_member", {
    p_team_id: invitation.team_id,
    p_user_id: invitation.from_user_id,
  })

  if (teamError) {
    return { error: teamError.message }
  }

  // Notify the requester
  await createNotification({
    userId: invitation.from_user_id,
    type: "invitation_accepted",
    title: "Join Request Accepted",
    message: `Your request to join "${invitation.team?.name}" has been accepted! You are now a member of the team.`,
    metadata: {
      teamId: invitation.team_id,
      invitationId,
    },
  })

  revalidatePath("/runner/teams")
  revalidatePath("/runner/dashboard")
  revalidatePath("/manager/teams")
  revalidatePath("/manager/invitations")

  return { success: true, teamName: invitation.team?.name }
}

export async function rejectJoinRequest(invitationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  // Get invitation details
  const { data: invitation } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name, manager_id)
    `)
    .eq("id", invitationId)
    .single()

  if (!invitation) {
    return { error: "Request not found" }
  }

  // Verify user is the team manager
  if (invitation.team?.manager_id !== user.id) {
    return { error: "You are not authorized to reject this request" }
  }

  // Update invitation status
  const { error: updateError } = await supabase
    .from("invitations")
    .update({ status: "rejected" })
    .eq("id", invitationId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Notify the requester
  await createNotification({
    userId: invitation.from_user_id,
    type: "invitation_rejected",
    title: "Join Request Declined",
    message: `Your request to join "${invitation.team?.name}" has been declined.`,
    metadata: {
      teamId: invitation.team_id,
      invitationId,
    },
  })

  revalidatePath("/manager/teams")
  revalidatePath("/manager/invitations")

  return { success: true }
}

export async function leaveTeam(teamId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  // Get team details
  const { data: team } = await supabase
    .from("teams")
    .select("*, manager:users!teams_manager_id_fkey(id, first_name)")
    .eq("id", teamId)
    .single()

  if (!team) {
    return { error: "Team not found" }
  }

  if (team.manager_id === user.id) {
    return { error: "Team managers cannot leave their own team. Transfer ownership or delete the team instead." }
  }

  // Remove user from team
  const { error: removeError } = await supabase.rpc("remove_team_member", {
    p_team_id: teamId,
    p_user_id: user.id,
  })

  if (removeError) {
    return { error: removeError.message }
  }

  // Get user details for notification
  const { data: userProfile } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single()

  // Notify the manager
  await createNotification({
    userId: team.manager_id,
    type: "team_update",
    title: "Team Member Left",
    message: `${userProfile?.first_name || "A runner"} ${userProfile?.last_name || ""} has left your team "${team.name}".`,
    metadata: {
      teamId,
      userId: user.id,
    },
  })

  revalidatePath("/runner/teams")
  revalidatePath("/runner/dashboard")
  revalidatePath("/manager/teams")

  return { success: true }
}