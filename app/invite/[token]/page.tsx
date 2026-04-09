import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { InviteClient } from "./invite-client"

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { createClient: createAdminClient } = await import("@supabase/supabase-js")
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: invitation, error } = await admin
    .from("invitations")
    .select(`
      *,
      team:teams(id, name, manager_id),
      from_user:users!invitations_from_user_id_fkey(id, email, first_name, last_name)
    `)
    .eq("invite_link", token)
    .single()

  if (error || !invitation) {
    return (
      <InviteClient
        status="invalid"
        message="This invitation link is invalid or has expired."
      />
    )
  }

  if (invitation.status === "accepted") {
    return (
      <InviteClient
        status="already_accepted"
        message="This invitation link has already been used and can no longer be shared."
        teamName={invitation.team?.name}
      />
    )
  }

  if (invitation.status === "rejected") {
    return (
      <InviteClient
        status="rejected"
        message="This invitation was declined."
      />
    )
  }

  const invitationData = {
    id: invitation.id,
    teamName: invitation.team?.name || "Unknown Team",
    inviterName: `${invitation.from_user?.first_name || ""} ${invitation.from_user?.last_name || ""}`.trim() || "A manager",
    inviterEmail: invitation.from_user?.email || "",
  }

  // Not logged in — show sign up / login options
  if (!user) {
    return (
      <InviteClient
        status="unauthenticated"
        token={token}
        invitation={invitationData}
      />
    )
  }

  // Get user profile
  const { data: userProfile } = await supabase
    .from("users")
    .select("email, role, first_name, last_name")
    .eq("id", user.id)
    .single()

  // Non-runner logged in — redirect to login with correct account
  if (userProfile?.role !== "runner") {
    const returnUrl = encodeURIComponent(`/invite/${token}`)
    redirect(`/auth/login?returnUrl=${returnUrl}&invite=true`)
  }

  // Check if already a member
  const { data: team } = await supabase
    .from("teams")
    .select("members, manager_id")
    .eq("id", invitation.team_id)
    .single()

  if (team?.members?.includes(user.id) || team?.manager_id === user.id) {
    return (
      <InviteClient
        status="already_member"
        message="You are already a member of this team."
        teamName={invitation.team?.name}
      />
    )
  }

  return (
    <InviteClient
      status="valid"
      invitation={invitationData}
      userId={user.id}
      userEmail={userProfile?.email || ""}
    />
  )
}
