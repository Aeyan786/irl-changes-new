import "server-only"

import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover" as any,
})

// Price per runner in cents ($10.00)
export const PRICE_PER_RUNNER_CENTS = 1000

// Calculate total fee based on team size
export function calculateRegistrationFee(runnerCount: number): number {
  return runnerCount * PRICE_PER_RUNNER_CENTS
}

// Format amount for display
export function formatAmount(amountInCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amountInCents / 100)
}
