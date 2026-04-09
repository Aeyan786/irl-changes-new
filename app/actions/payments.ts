"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { Resend } from "resend"
import { render } from "@react-email/render"
import { InvoiceEmail } from "@/components/invoice-email"
import { createNotification } from "./notifications"

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const resend = new Resend(process.env.RESEND_API_KEY)

// Helper to get all admin user IDs
async function getAdminUserIds(): Promise<string[]> {
  const admin = getAdminClient()
  const { data } = await admin
    .from("users")
    .select("id")
    .eq("role", "admin")
  return (data || []).map((u) => u.id)
}

export async function verifyPayment(paymentId: string, registrationId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") return { error: "Unauthorized" }

  const admin = getAdminClient()

  const { data: payment, error: fetchError } = await admin
    .from("payments")
    .select(`
      id,
      amount,
      registration:registrations(
        id,
        runners,
        team:teams(
          id,
          name,
          manager:users!teams_manager_id_fkey(
            id,
            first_name,
            last_name,
            email
          )
        ),
        race:races(
          id,
          title,
          date,
          venue
        )
      )
    `)
    .eq("id", paymentId)
    .single()

  if (fetchError || !payment) return { error: "Payment record not found" }

  const { error: paymentError } = await admin
    .from("payments")
    .update({ status: "paid" })
    .eq("id", paymentId)

  if (paymentError) return { error: paymentError.message }

  const { error: regError } = await admin
    .from("registrations")
    .update({
      payment_status: "paid",
      paid_amount: payment.amount,
    })
    .eq("id", registrationId)

  if (regError) return { error: regError.message }

  // Notify manager that payment has been verified
  const reg = payment.registration as any
  const team = reg?.team
  const race = reg?.race
  const manager = team?.manager

  if (manager?.id) {
    await createNotification({
      userId: manager.id,
      type: "payment_success",
      title: "Payment Verified",
      message: `Your payment for "${race?.title}" has been verified by admin. Your team "${team?.name}" is now officially registered.`,
      metadata: { paymentId, registrationId, raceId: race?.id },
    })
  }

  // Send invoice email to manager
  try {
    if (manager?.email) {
      const managerName = [manager.first_name, manager.last_name].filter(Boolean).join(" ") || "Manager"
      const runnerCount = Array.isArray(reg.runners) ? reg.runners.length : 1

      const html = await render(
        InvoiceEmail({
          managerName,
          teamName: team?.name || "Your Team",
          raceName: race?.title || "Race",
          raceDate: race?.date || new Date().toISOString(),
          raceVenue: race?.venue || "",
          runnerCount,
          amount: payment.amount,
          paymentId,
          paidAt: new Date().toISOString(),
        })
      )

      await resend.emails.send({
        from: "Infinite Running League <receipts@saatish.com>",
        to: manager.email,
        subject: `Payment Receipt – ${race?.title || "Race Registration"}`,
        html,
      })
    }
  } catch (emailError) {
    console.error("Failed to send invoice email:", emailError)
  }

  revalidatePath("/admin/payments")
  revalidatePath("/admin/registrations")
  return { success: true }
}

export async function submitRefundRequest(
  paymentId: string,
  registrationId: string,
  teamId: string,
  reason: string
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Verify the user is the team manager
  const { data: team } = await supabase
    .from("teams")
    .select("manager_id, name")
    .eq("id", teamId)
    .single()

  if (team?.manager_id !== user.id) return { error: "Only team managers can request refunds" }

  // Check payment is actually paid
  const { data: payment } = await supabase
    .from("payments")
    .select("status")
    .eq("id", paymentId)
    .single()

  if (payment?.status !== "paid") return { error: "Only paid registrations can be refunded" }

  // Check registration deadline has not passed
  const { data: registration } = await supabase
    .from("registrations")
    .select(`
      id,
      race:races(id, title, registration_deadline)
    `)
    .eq("id", registrationId)
    .single()

  const race = registration?.race as any
  if (race?.registration_deadline) {
    const deadline = new Date(race.registration_deadline)
    if (new Date() > deadline) {
      return { error: `Refund requests are only allowed before the registration deadline (${deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}).` }
    }
  }

  // Check no existing pending refund request
  const { data: existing } = await supabase
    .from("refund_requests")
    .select("id")
    .eq("payment_id", paymentId)
    .eq("status", "pending")
    .single()

  if (existing) return { error: "A refund request for this payment is already pending" }

  const { error } = await supabase
    .from("refund_requests")
    .insert({
      payment_id: paymentId,
      registration_id: registrationId,
      team_id: teamId,
      manager_id: user.id,
      reason,
    })

  if (error) return { error: error.message }

  // Notify all admins of the new refund request
  const adminIds = await getAdminUserIds()
  for (const adminId of adminIds) {
    await createNotification({
      userId: adminId,
      type: "payment_failed",
      title: "New Refund Request",
      message: `Team "${team?.name}" has submitted a refund request for "${race?.title}". Reason: "${reason}"`,
      metadata: { paymentId, registrationId, teamId, raceId: race?.id },
    })
  }

  // Email all admins
  try {
    const admin = getAdminClient()
    const { data: adminUsers } = await admin
      .from("users")
      .select("email, first_name, last_name")
      .eq("role", "admin")

    const managerData = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single()

    const managerName = [managerData.data?.first_name, managerData.data?.last_name].filter(Boolean).join(" ") || "A manager"

    for (const adminUser of adminUsers || []) {
      await resend.emails.send({
        from: "Infinite Running League <no-reply@saatish.com>",
        to: adminUser.email,
        subject: `New Refund Request – ${race?.title || "Race Registration"}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: #CC0000; border-radius: 8px 8px 0 0; padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">New Refund Request</h1>
            </div>
            <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 32px;">
              <p style="color: #374151;">Hi <strong>${[adminUser.first_name, adminUser.last_name].filter(Boolean).join(" ") || "Admin"}</strong>,</p>
              <p style="color: #6b7280; line-height: 1.6;">
                <strong>${managerName}</strong> from team <strong>${team?.name}</strong> has submitted a refund request for 
                <strong>${race?.title || "a race"}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-radius:0 8px 8px 0;border-left:4px solid #CC0000;background-color:#fff5f5;">
                <tr><td style="padding:10px 16px;font-size:14px;color:#6b7280;width:40%;">Team</td><td style="padding:10px 16px;font-size:14px;color:#111827;font-weight:600;">${team?.name}</td></tr>
                <tr><td style="padding:10px 16px;font-size:14px;color:#6b7280;">Race</td><td style="padding:10px 16px;font-size:14px;color:#111827;font-weight:600;">${race?.title}</td></tr>
                <tr><td style="padding:10px 16px;font-size:14px;color:#6b7280;">Reason</td><td style="padding:10px 16px;font-size:14px;color:#111827;font-weight:600;">${reason}</td></tr>
              </table>
              <p style="color: #6b7280;">Please log in to the admin portal to review and process this request.</p>
              <p style="color: #9ca3af; font-size: 13px; margin-top: 32px;">
                Questions? <a href="mailto:support@saatish.com" style="color: #CC0000;">support@saatish.com</a>
              </p>
            </div>
          </div>
        `,
      })
    }
  } catch (emailError) {
    console.error("Failed to send admin refund notification email:", emailError)
  }

  revalidatePath("/manager/payments")
  return { success: true }
}

export async function processRefundRequest(
  refundRequestId: string,
  action: "approve" | "reject",
  adminNote?: string
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") return { error: "Unauthorized" }

  const admin = getAdminClient()

  const { data: refundReq, error: fetchError } = await admin
    .from("refund_requests")
    .select(`
      id,
      status,
      payment_id,
      registration_id,
      team_id,
      manager_id,
      reason,
      payment:payments(id, stripe_id, amount),
      manager:users!refund_requests_manager_id_fkey(
        id, first_name, last_name, email
      ),
      team:teams(id, name),
      registration:registrations(
        id,
        race:races(id, title)
      )
    `)
    .eq("id", refundRequestId)
    .single()

  if (fetchError || !refundReq) return { error: "Refund request not found" }
  if (refundReq.status === "approved" || refundReq.status === "rejected") {
    return { error: "This refund request has already been processed" }
  }

  const manager = refundReq.manager as any
  const team = refundReq.team as any
  const race = (refundReq.registration as any)?.race
  const payment = refundReq.payment as any

  if (action === "reject") {
    const { error } = await admin
      .from("refund_requests")
      .update({ status: "rejected", admin_note: adminNote || null, updated_at: new Date().toISOString() })
      .eq("id", refundRequestId)

    if (error) return { error: error.message }

    // Notify manager of rejection via in-app notification
    if (manager?.id) {
      await createNotification({
        userId: manager.id,
        type: "payment_failed",
        title: "Refund Request Rejected",
        message: `Your refund request for "${race?.title}" has been rejected.${adminNote ? ` Admin note: "${adminNote}"` : ""}`,
        metadata: { refundRequestId, raceId: race?.id, teamId: refundReq.team_id },
      })
    }

    // Send rejection email
    try {
      if (manager?.email) {
        const managerName = [manager.first_name, manager.last_name].filter(Boolean).join(" ") || "Manager"
        await resend.emails.send({
          from: "Infinite Running League <no-reply@saatish.com>",
          to: manager.email,
          subject: `Refund Request Update – ${race?.title || "Race Registration"}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: #CC0000; border-radius: 8px 8px 0 0; padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Refund Request Rejected</h1>
              </div>
              <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 32px;">
                <p style="color: #374151;">Hi <strong>${managerName}</strong>,</p>
                <p style="color: #6b7280; line-height: 1.6;">
                  Your refund request for <strong>${team?.name}</strong>'s registration in
                  <strong>${race?.title || "the race"}</strong> has been <strong style="color: #dc2626;">rejected</strong>.
                </p>
                ${adminNote ? `<p style="color: #6b7280;"><strong>Admin note:</strong> ${adminNote}</p>` : ""}
                <p style="color: #9ca3af; font-size: 13px; margin-top: 32px;">
                  If you have questions, contact us at <a href="mailto:support@saatish.com" style="color: #CC0000;">support@saatish.com</a>
                </p>
              </div>
            </div>
          `,
        })
      }
    } catch (emailError) {
      console.error("Failed to send rejection email:", emailError)
    }

    revalidatePath("/admin/payments")
    revalidatePath("/manager/payments")
    return { success: true }
  }

  // APPROVE: issue Stripe refund if stripe_id exists
  let stripeRefundId: string | null = null

  if (payment?.stripe_id) {
    try {
      const { stripe } = await import("@/lib/stripe")
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripe_id,
        metadata: {
          refund_request_id: refundRequestId,
          registration_id: refundReq.registration_id,
          team_id: refundReq.team_id,
        },
      })
      stripeRefundId = refund.id
    } catch (stripeError: any) {
      console.error("Stripe refund error:", stripeError)
      return { error: `Stripe refund failed: ${stripeError.message}` }
    }
  }

  // Update refund request → approved
  await admin
    .from("refund_requests")
    .update({
      status: "approved",
      admin_note: adminNote || null,
      stripe_refund_id: stripeRefundId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", refundRequestId)

  // Update payment status → refunded
  await admin
    .from("payments")
    .update({ status: "refunded" })
    .eq("id", refundReq.payment_id)

  // Update registration payment_status → refunded
  await admin
    .from("registrations")
    .update({ payment_status: "refunded" })
    .eq("id", refundReq.registration_id)

  // Remove team from race
  await admin
    .from("registrations")
    .delete()
    .eq("id", refundReq.registration_id)

  // Notify manager of approval via in-app notification
  if (manager?.id) {
    await createNotification({
      userId: manager.id,
      type: "payment_success",
      title: "Refund Approved",
      message: `Your refund of $${payment?.amount?.toFixed(2)} for "${race?.title}" has been approved. Your team has been removed from the race. Please allow 5–10 business days for the refund to appear.`,
      metadata: { refundRequestId, raceId: race?.id, teamId: refundReq.team_id },
    })
  }

  // Send approval email to manager
  try {
    if (manager?.email) {
      const managerName = [manager.first_name, manager.last_name].filter(Boolean).join(" ") || "Manager"
      await resend.emails.send({
        from: "Infinite Running League <no-reply@saatish.com>",
        to: manager.email,
        subject: `Refund Approved – ${race?.title || "Race Registration"}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: #CC0000; border-radius: 8px 8px 0 0; padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Refund Approved</h1>
            </div>
            <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 32px;">
              <p style="color: #374151;">Hi <strong>${managerName}</strong>,</p>
              <p style="color: #6b7280; line-height: 1.6;">
                Your refund request for <strong>${team?.name}</strong>'s registration in
                <strong>${race?.title || "the race"}</strong> has been <strong style="color: #16a34a;">approved</strong>.
              </p>
              <p style="color: #6b7280; line-height: 1.6;">
                A refund of <strong>$${payment?.amount?.toFixed(2)}</strong> has been issued and your team has been removed from the race.
                Please allow 5–10 business days for the amount to reflect in your account.
              </p>
              ${adminNote ? `<p style="color: #6b7280;"><strong>Admin note:</strong> ${adminNote}</p>` : ""}
              <p style="color: #9ca3af; font-size: 13px; margin-top: 32px;">
                If you have questions, contact us at <a href="mailto:support@saatish.com" style="color: #CC0000;">support@saatish.com</a>
              </p>
            </div>
          </div>
        `,
      })
    }
  } catch (emailError) {
    console.error("Failed to send refund approval email:", emailError)
  }

  revalidatePath("/admin/payments")
  revalidatePath("/admin/registrations")
  revalidatePath("/manager/payments")
  return { success: true }
}