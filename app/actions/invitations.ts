"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"
import { sendTeamInviteEmail } from "@/lib/email"
import { randomBytes } from "crypto"

// Generate a unique invite link token
function generateInviteToken(): string {
  return randomBytes(32).toString("hex")
}

export async function sendTeamInviteByEmail(teamId: string, email: string) {
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
    .select("*, manager:users!teams_manager_id_fkey(first_name, last_name, email)")
    .eq("id", teamId)
    .single()

  if (teamError || !team) {
    return { error: "Team not found" }
  }

  // Verify user is the team manager or a member who can invite
  const isMember = team.members?.includes(user.id) || team.manager_id === user.id
  if (!isMember) {
    return { error: "You must be a team member to send invitations" }
  }

// Check if user with this email exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, email, first_name, current_team_id")
    .eq("email", email.toLowerCase())
    .single()

  // Check if user is already in a team
  if (existingUser?.current_team_id) {
    return { error: "This runner is already a member of another team." }
  }

  // Check if there's already a pending invitation
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

  // Check if user is already a member
  if (existingUser && (team.members?.includes(existingUser.id) || team.manager_id === existingUser.id)) {
    return { error: "This user is already a member of the team" }
  }

  // Generate invite link
  const inviteToken = generateInviteToken()
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const inviteLink = `${baseUrl}/invite/${inviteToken}`

  // Create invitation
  const { error: inviteError } = await supabase.from("invitations").insert({
    from_user_id: user.id,
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

  // Get sender details
  const { data: senderProfile } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single()

// Send email notification
  const inviterName = `${senderProfile?.first_name || "A team manager"} ${senderProfile?.last_name || ""}`.trim()
  const recipientName = existingUser?.first_name || "there"
  await sendTeamInviteEmail(
    email.toLowerCase(),
    recipientName,
    team.name,
    inviterName,
    inviteLink
  )

  // If user exists in the system, create an in-app notification
  if (existingUser) {
    await createNotification({
      userId: existingUser.id,
      type: "invitation_received",
      title: "Team Invitation",
      message: `${senderProfile?.first_name || "Someone"} ${senderProfile?.last_name || ""} has invited you to join team "${team.name}".`,
      metadata: {
        teamId,
        inviteLink: inviteToken,
      },
    })
  }

  revalidatePath("/runner/invitations")
  revalidatePath("/runner/teams")

  return { 
    success: true, 
    teamName: team.name,
    inviteLink,
    recipientExists: !!existingUser,
  }
}

export async function generateTeamInviteLink(teamId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  // Get team details and verify membership
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single()

  if (teamError || !team) {
    return { error: "Team not found" }
  }

  // Verify user is the team manager or member
  const isMember = team.members?.includes(user.id) || team.manager_id === user.id
  if (!isMember) {
    return { error: "You must be a team member to generate invite links" }
  }

  // Generate invite link token
  const inviteToken = generateInviteToken()
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const inviteLink = `${baseUrl}/invite/${inviteToken}`

// Create a generic invitation (using placeholder email for constraint compliance)
  const { error: inviteError } = await supabase.from("invitations").insert({
    from_user_id: user.id,
    to_email: `invite-link-${inviteToken.substring(0, 8)}@placeholder.local`,
    to_user_id: null,
    team_id: teamId,
    type: "team_join",
    status: "pending",
    invite_link: inviteToken,
  })

  if (inviteError) {
    return { error: inviteError.message }
  }

  revalidatePath("/runner/invitations")

  return { 
    success: true, 
    inviteLink,
    teamName: team.name,
  }
}

export async function getMyInvitations() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in", invitations: [] }
  }

  // Get user email
  const { data: userProfile } = await supabase
    .from("users")
    .select("email")
    .eq("id", user.id)
    .single()

  // Get invitations where user is recipient (by id or email)
  const { data: receivedInvitations, error: receivedError } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name, manager_id),
      from_user:users!invitations_from_user_id_fkey(id, first_name, last_name, email)
    `)
    .eq("status", "pending")
    .eq("type", "team_join")
    .or(`to_user_id.eq.${user.id},to_email.eq.${userProfile?.email || ""}`)
    .order("created_at", { ascending: false })

  if (receivedError) {
    return { error: receivedError.message, invitations: [] }
  }

  return { invitations: receivedInvitations || [] }
}

export async function getSentInvitations() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in", invitations: [] }
  }

  // Get invitations sent by user
  const { data: sentInvitations, error: sentError } = await supabase
    .from("invitations")
    .select(`
      *,
      team:teams(id, name),
      to_user:users!invitations_to_user_id_fkey(id, first_name, last_name, email)
    `)
    .eq("from_user_id", user.id)
    .eq("type", "team_join")
    .order("created_at", { ascending: false })

  if (sentError) {
    return { error: sentError.message, invitations: [] }
  }

  return { invitations: sentInvitations || [] }
}

export async function cancelInvitation(invitationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in" }
  }

  // Get invitation and verify ownership
  const { data: invitation } = await supabase
    .from("invitations")
    .select("*")
    .eq("id", invitationId)
    .eq("from_user_id", user.id)
    .eq("status", "pending")
    .single()

  if (!invitation) {
    return { error: "Invitation not found or already processed" }
  }

  // Delete the invitation
  const { error: deleteError } = await supabase
    .from("invitations")
    .delete()
    .eq("id", invitationId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  revalidatePath("/runner/invitations")

  return { success: true }
}

export async function resendInvitation(invitationId: string) {
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
      team:teams(id, name)
    `)
    .eq("id", invitationId)
    .eq("from_user_id", user.id)
    .eq("status", "pending")
    .single()

  if (!invitation) {
    return { error: "Invitation not found or already processed" }
  }

  // Get sender details
  const { data: senderProfile } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single()

  // If recipient exists, send notification
  if (invitation.to_user_id) {
    await createNotification({
      userId: invitation.to_user_id,
      type: "invitation_received",
      title: "Team Invitation Reminder",
      message: `${senderProfile?.first_name || "Someone"} ${senderProfile?.last_name || ""} is reminding you about their invitation to join team "${invitation.team?.name}".`,
      metadata: {
        teamId: invitation.team_id,
        inviteLink: invitation.invite_link,
      },
    })
  }

  // Resend email if there's an email address
  if (invitation.to_email && invitation.invite_link) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const inviteLink = `${baseUrl}/invite/${invitation.invite_link}`
    const senderName = `${senderProfile?.first_name || "A team manager"} ${senderProfile?.last_name || ""}`.trim()
    
    await sendTeamInviteEmail(
      invitation.to_email,
      "there",
      invitation.team?.name || "the team",
      senderName,
      inviteLink
    )
  }

  revalidatePath("/runner/invitations")
  revalidatePath("/manager/invitations")

  return { 
    success: true,
    email: invitation.to_email,
    teamName: invitation.team?.name,
  }
}
