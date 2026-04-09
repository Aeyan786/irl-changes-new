import { NextRequest, NextResponse } from "next/server"
import { stripe, calculateRegistrationFee, PRICE_PER_RUNNER_CENTS } from "@/lib/stripe"
import { createClient } from "@/lib/supabase/server"
import { rateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = rateLimit(getRateLimitIdentifier(request.headers), {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 payment intents per minute
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rateLimitResult.resetIn / 1000).toString(),
          },
        }
      )
    }

    

    // Parse request body
    const body = await request.json()
    const { registrationId } = body

    if (!registrationId) {
      return NextResponse.json(
        { error: "Registration ID is required" },
        { status: 400 }
      )
    }

    // Get Supabase client and verify authentication
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch registration details
    const { data: registration, error: registrationError } = await supabase
      .from("registrations")
      .select(`
        id,
        team_id,
        runners,
        payment_status,
        teams!inner (
          id,
          name,
          manager_id
        )
      `)
      .eq("id", registrationId)
      .single()

    if (registrationError || !registration) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      )
    }

    // Verify user is the team manager
    const team = registration.teams as unknown as { id: string; name: string; manager_id: string }
    if (team.manager_id !== user.id) {
      return NextResponse.json(
        { error: "Only team managers can make payments" },
        { status: 403 }
      )
    }

    // Check if already paid
    if (registration.payment_status === "paid") {
      return NextResponse.json(
        { error: "This registration has already been paid" },
        { status: 400 }
      )
    }

    // Calculate fee based on number of runners
    const runnerCount = registration.runners?.length || 1
    const amountInCents = calculateRegistrationFee(runnerCount)

    // Check for existing pending payment intent
    const { data: existingPayments } = await supabase
      .from("payments")
      .select("id, stripe_id")
      .eq("registration_id", registrationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)

    const existingPayment = existingPayments?.[0]

    if (existingPayment?.stripe_id) {
      // Retrieve existing payment intent
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(existingPayment.stripe_id)
        if (
          existingIntent.status === "requires_payment_method" ||
          existingIntent.status === "requires_confirmation"
        ) {
          return NextResponse.json({
            clientSecret: existingIntent.client_secret,
            amount: existingIntent.amount,
            runnerCount,
            pricePerRunner: PRICE_PER_RUNNER_CENTS,
          })
        }
      } catch {
        // Payment intent doesn't exist or is invalid, create new one
      }
    }

    // Create new payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        registration_id: registrationId,
        team_id: team.id,
        team_name: team.name,
        runner_count: runnerCount.toString(),
        user_id: user.id,
      },
    })

    // Store payment intent in database
    if (existingPayment?.id) {
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          stripe_id: paymentIntent.id,
          amount: amountInCents / 100,
          status: "pending",
        })
        .eq("id", existingPayment.id)

      if (updateError) {
        console.error("Failed to update payment record:", updateError)
      }

      // Clean up duplicate payment rows
      const { data: allPayments } = await supabase
        .from("payments")
        .select("id")
        .eq("registration_id", registrationId)
        .neq("id", existingPayment.id)

      if (allPayments && allPayments.length > 0) {
        await supabase
          .from("payments")
          .delete()
          .in("id", allPayments.map((p) => p.id))
      }
    } else {
      const { error: insertError } = await supabase
        .from("payments")
        .insert({
          registration_id: registrationId,
          stripe_id: paymentIntent.id,
          amount: amountInCents / 100,
          status: "pending",
        })

      if (insertError) {
        console.error("Failed to create payment record:", insertError)
      }
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: amountInCents,
      runnerCount,
      pricePerRunner: PRICE_PER_RUNNER_CENTS,
    })
  } catch (error) {
    console.error("Payment intent creation error:", error)
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    )
  }
}