import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia",
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated and is an admin
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { amount, description } = body

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      )
    }

    // Get available balance from Stripe
    const balance = await stripe.balance.retrieve()
    const availableBalance = balance.available.find(
      (b) => b.currency === "usd"
    )?.amount || 0

    // Convert amount to cents for Stripe
    const amountInCents = Math.round(amount * 100)

    if (amountInCents > availableBalance) {
      return NextResponse.json(
        {
          error: `Insufficient funds. Available balance: $${(availableBalance / 100).toFixed(2)}`,
        },
        { status: 400 }
      )
    }

    // Create payout in Stripe
    const payout = await stripe.payouts.create({
      amount: amountInCents,
      currency: "usd",
      description: description || "Admin withdrawal",
      metadata: {
        admin_id: user.id,
        created_by: user.email || "admin",
      },
    })

    // Record payout in database
    const { data: payoutRecord, error: dbError } = await supabase
      .from("payouts")
      .insert({
        admin_id: user.id,
        amount: amount,
        stripe_payout_id: payout.id,
        status: payout.status as "pending" | "paid" | "failed" | "cancelled",
        destination: payout.destination as string || "default",
        description: description || "Admin withdrawal",
        metadata: {
          stripe_arrival_date: payout.arrival_date,
          stripe_method: payout.method,
          stripe_type: payout.type,
        },
      })
      .select()
      .single()

    if (dbError) {
      console.error("Failed to record payout in database:", dbError)
      // Payout was created in Stripe, so we still return success
      // but log the database error
    }

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        amount: amount,
        status: payout.status,
        arrival_date: payout.arrival_date,
        record_id: payoutRecord?.id,
      },
    })
  } catch (error) {
    console.error("Payout error:", error)

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to create payout" },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve payout history
export async function GET() {
  try {
    const supabase = await createClient()

    // Verify user is authenticated and is an admin
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      )
    }

    // Get payout history
    const { data: payouts, error: payoutsError } = await supabase
      .from("payouts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)

    if (payoutsError) {
      throw payoutsError
    }

    // Get Stripe balance
    const balance = await stripe.balance.retrieve()
    const availableBalance = balance.available.find(
      (b) => b.currency === "usd"
    )?.amount || 0
    const pendingBalance = balance.pending.find(
      (b) => b.currency === "usd"
    )?.amount || 0

    return NextResponse.json({
      payouts,
      balance: {
        available: availableBalance / 100,
        pending: pendingBalance / 100,
      },
    })
  } catch (error) {
    console.error("Error fetching payouts:", error)
    return NextResponse.json(
      { error: "Failed to fetch payouts" },
      { status: 500 }
    )
  }
}
