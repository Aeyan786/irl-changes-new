import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendInvitationAcceptedEmail, sendRegistrationSuccessEmail } from "@/lib/email"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { type, recipientEmail, recipientName, data } = body

    if (!type || !recipientEmail || !recipientName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    let result

    switch (type) {
      case "invitation_accepted":
        if (!data?.teamName || !data?.runnerName) {
          return NextResponse.json(
            { error: "Missing team data for invitation accepted email" },
            { status: 400 }
          )
        }
        result = await sendInvitationAcceptedEmail(
          recipientEmail,
          recipientName,
          data.runnerName,
          data.teamName
        )
        break

      case "registration_success":
        if (!data?.teamName || !data?.raceName || !data?.raceDate || !data?.amount) {
          return NextResponse.json(
            { error: "Missing data for registration success email" },
            { status: 400 }
          )
        }
        result = await sendRegistrationSuccessEmail(
          recipientEmail,
          recipientName,
          data.teamName,
          data.raceName,
          data.raceDate,
          data.amount
        )
        break

      default:
        return NextResponse.json(
          { error: "Invalid email type" },
          { status: 400 }
        )
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending notification email:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
