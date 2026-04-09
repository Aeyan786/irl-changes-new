"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"
import { sendTeamInviteEmail, sendInvitationAcceptedEmail } from "@/lib/email"
import { randomBytes } from "crypto"

// Check if current user is an admin
async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in", isAdmin: false }
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return { error: "Admin access required", isAdmin: false }
  }

  return { isAdmin: true, userId: user.id }
}

// Admin: Send team invitation
export async function adminSendTeamInvitation(
  teamId: string,
  email: string,
  targetRole: "runner" | "manager"
) {
  const { isAdmin, error: adminError } = await verifyAdmin()
  if (!isAdmin) return { error: adminError }

  const supabase = await createClient()

  // Get team details
  const { data: team } = await supabase
    .from("teams")
    .select("*, manager:users!teams_manager_id_fkey(email, first_name, last_name)")
    .eq("id", teamId)
    .single()

  if (!team) {
    return { error: "Team not found" }
  }

  // Check if user exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, email, first_name, role")
    .eq("email", email.toLowerCase())
    .single()

  // Verify role matches if user exists
  if (existingUser && existingUser.role !== targetRole) {
    return { error: `User is a ${existingUser.role}, not a ${targetRole}` }
  }

  // Check for existing pending invitation
  const { data: existingInvite } = await supabase
    .from("invitations")
    .select("id")
    .eq("team_id", teamId)
    .eq("status", "pending")
    .or(`to_email.eq.${email.toLowerCase()},to_user_id.eq.${existingUser?.id || "00000000-0000-0000-0000-000000000000"}`)
    .single()

  if (existingInvite) {
    return { error: "There is already a pending invitation for this email" }
  }

  // Generate invite token
  const inviteToken = randomBytes(32).toString("hex")
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const inviteLink = `${baseUrl}/invite/${inviteToken}`

  // Create invitation (from the team manager or admin)
  const { error: inviteError } = await supabase.from("invitations").insert({
    from_user_id: team.manager_id,
    to_email: email.toLowerCase(),
    to_user_id: existingUser?.id || null,
    team_id: teamId,
    type: "team_join",
    status: "pending",
    invite_link: inviteToken,
  })

  if (inviteError) {
    return { error: inviteError.message }
  }

  // Send email
  const managerName = team.manager
    ? `${team.manager.first_name || ""} ${team.manager.last_name || ""}`.trim() || "Team Manager"
    : "IRL Admin"
  const recipientName = existingUser?.first_name || "there"
  
  await sendTeamInviteEmail(
    email.toLowerCase(),
    recipientName,
    team.name,
    managerName,
    inviteLink
  )

  // If user exists, create in-app notification
  if (existingUser) {
    await createNotification({
      userId: existingUser.id,
      type: "invitation_received",
      title: "Team Invitation",
      message: `You have been invited to join team "${team.name}" by an administrator.`,
      metadata: {
        teamId,
        inviteLink: inviteToken,
      },
    })
  }

  revalidatePath("/admin/teams")
  revalidatePath("/runner/invitations")
  revalidatePath("/manager/invitations")

  return { success: true, teamName: team.name }
}

// Admin: Force accept an invitation
export async function adminForceAcceptInvitation(invitationId: string) {
  const { isAdmin, error: adminError } = await verifyAdmin()
  if (!isAdmin) return { error: adminError }

  const supabase = await createClient()

  // Get invitation details
  const { data: invitation } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name, manager_id),
      from_user:users!invitations_from_user_id_fkey(email, first_name, last_name),
      to_user:users!invitations_to_user_id_fkey(id, email, first_name, last_name)
    `)
    .eq("id", invitationId)
    .single()

  if (!invitation) {
    return { error: "Invitation not found" }
  }

  if (invitation.status !== "pending") {
    return { error: "Invitation is not pending" }
  }

  // Update invitation status
  const { error: updateError } = await supabase
    .from("invitations")
    .update({ status: "accepted" })
    .eq("id", invitationId)

  if (updateError) {
    return { error: updateError.message }
  }

  // If to_user exists, add them to the team
  if (invitation.to_user_id && invitation.team_id) {
    const { error: teamError } = await supabase.rpc("add_team_member", {
      p_team_id: invitation.team_id,
      p_user_id: invitation.to_user_id,
    })

    if (teamError) {
      // Rollback the status update
      await supabase
        .from("invitations")
        .update({ status: "pending" })
        .eq("id", invitationId)
      return { error: teamError.message }
    }

    // Notify the user
    await createNotification({
      userId: invitation.to_user_id,
      type: "invitation_accepted",
      title: "Added to Team",
      message: `An administrator has added you to team "${invitation.team?.name}".`,
      metadata: {
        teamId: invitation.team_id,
        invitationId,
      },
    })

    // Notify the manager
    if (invitation.team?.manager_id) {
      await createNotification({
        userId: invitation.team.manager_id,
        type: "team_update",
        title: "New Team Member",
        message: `${invitation.to_user?.first_name || "A runner"} ${invitation.to_user?.last_name || ""} was added to your team "${invitation.team.name}" by an administrator.`,
        metadata: {
          teamId: invitation.team_id,
          userId: invitation.to_user_id,
        },
      })

      // Send email to manager
      if (invitation.from_user?.email) {
        const managerName = `${invitation.from_user.first_name || ""} ${invitation.from_user.last_name || ""}`.trim() || "Manager"
        const runnerName = `${invitation.to_user?.first_name || ""} ${invitation.to_user?.last_name || ""}`.trim() || "A runner"
        await sendInvitationAcceptedEmail(
          invitation.from_user.email,
          managerName,
          runnerName,
          invitation.team.name
        )
      }
    }
  }

  revalidatePath("/admin/teams")
  revalidatePath("/runner/teams")
  revalidatePath("/manager/teams")

  return { success: true, teamName: invitation.team?.name }
}

// Admin: Force reject an invitation
export async function adminForceRejectInvitation(invitationId: string) {
  const { isAdmin, error: adminError } = await verifyAdmin()
  if (!isAdmin) return { error: adminError }

  const supabase = await createClient()

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

  // Notify relevant users
  if (invitation.to_user_id) {
    await createNotification({
      userId: invitation.to_user_id,
      type: "invitation_rejected",
      title: "Invitation Cancelled",
      message: `The invitation to join "${invitation.team?.name}" was cancelled by an administrator.`,
      metadata: {
        teamId: invitation.team_id,
        invitationId,
      },
    })
  }

  if (invitation.team?.manager_id) {
    await createNotification({
      userId: invitation.team.manager_id,
      type: "team_update",
      title: "Invitation Rejected",
      message: `An administrator has rejected a pending invitation for team "${invitation.team.name}".`,
      metadata: {
        teamId: invitation.team_id,
        invitationId,
      },
    })
  }

  revalidatePath("/admin/teams")
  revalidatePath("/runner/invitations")
  revalidatePath("/manager/invitations")

  return { success: true }
}

// Admin: Delete an invitation
export async function adminDeleteInvitation(invitationId: string) {
  const { isAdmin, error: adminError } = await verifyAdmin()
  if (!isAdmin) return { error: adminError }

  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from("invitations")
    .delete()
    .eq("id", invitationId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  revalidatePath("/admin/teams")
  revalidatePath("/runner/invitations")
  revalidatePath("/manager/invitations")

  return { success: true }
}
