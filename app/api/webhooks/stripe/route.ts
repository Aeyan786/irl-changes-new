import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"
import { sendRegistrationSuccessEmail } from "@/lib/email"
import type Stripe from "stripe"

// Create admin Supabase client for webhook (bypasses RLS)
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    // Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } else {
      // For development without webhook secret
      event = JSON.parse(body) as Stripe.Event
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentSuccess(supabase, paymentIntent)
        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentFailure(supabase, paymentIntent)
        break
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentCanceled(supabase, paymentIntent)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook handler error:", error)
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    )
  }
}

async function handlePaymentSuccess(
  supabase: ReturnType<typeof createAdminClient>,
  paymentIntent: Stripe.PaymentIntent
) {
  const registrationId = paymentIntent.metadata.registration_id

  if (!registrationId) {
    console.error("No registration_id in payment intent metadata")
    return
  }

  // Update payment record
  const { error: paymentError } = await supabase
    .from("payments")
    .update({
      status: "paid",
      stripe_id: paymentIntent.id,
    })
    .eq("registration_id", registrationId)

  if (paymentError) {
    console.error("Failed to update payment record:", paymentError)
  }

  // Update registration payment status
  const { data: registrationData, error: registrationError } = await supabase
    .from("registrations")
    .update({
      payment_status: "paid",
      paid_amount: paymentIntent.amount / 100, // Convert cents to dollars
    })
    .eq("id", registrationId)
    .select(`
      id,
      race_id,
      team_id,
      teams(id, name, manager_id, manager:users!teams_manager_id_fkey(email, first_name, last_name)),
      races(id, title, date)
    `)
    .single()

  if (registrationError) {
    console.error("Failed to update registration:", registrationError)
  }

  // Send confirmation email to team manager
  if (registrationData) {
    const team = registrationData.teams as { id: string; name: string; manager_id: string; manager: { email: string; first_name: string | null; last_name: string | null } }
    const race = registrationData.races as { id: string; title: string; date: string }

    if (team?.manager?.email && race) {
      const managerName = `${team.manager.first_name || ""} ${team.manager.last_name || ""}`.trim() || "Team Manager"
      try {
        await sendRegistrationSuccessEmail(
          team.manager.email,
          managerName,
          team.name,
          race.title,
          race.date,
          paymentIntent.amount // already in cents
        )
        console.log(`Registration confirmation email sent to ${team.manager.email}`)
      } catch (emailError) {
        console.error("Failed to send registration confirmation email:", emailError)
      }
    }
  }

  console.log(`Payment succeeded for registration ${registrationId}`)
}

async function handlePaymentFailure(
  supabase: ReturnType<typeof createAdminClient>,
  paymentIntent: Stripe.PaymentIntent
) {
  const registrationId = paymentIntent.metadata.registration_id

  if (!registrationId) {
    console.error("No registration_id in payment intent metadata")
    return
  }

  // Update payment record
  const { error: paymentError } = await supabase
    .from("payments")
    .update({
      status: "failed",
    })
    .eq("registration_id", registrationId)

  if (paymentError) {
    console.error("Failed to update payment record:", paymentError)
  }

  // Update registration payment status
  const { error: registrationError } = await supabase
    .from("registrations")
    .update({
      payment_status: "failed",
    })
    .eq("id", registrationId)

  if (registrationError) {
    console.error("Failed to update registration:", registrationError)
  }

  console.log(`Payment failed for registration ${registrationId}`)
}

async function handlePaymentCanceled(
  supabase: ReturnType<typeof createAdminClient>,
  paymentIntent: Stripe.PaymentIntent
) {
  const registrationId = paymentIntent.metadata.registration_id

  if (!registrationId) {
    return
  }

  // Update payment record
  const { error: paymentError } = await supabase
    .from("payments")
    .update({
      status: "canceled",
    })
    .eq("registration_id", registrationId)

  if (paymentError) {
    console.error("Failed to update payment record:", paymentError)
  }

  console.log(`Payment canceled for registration ${registrationId}`)
}
