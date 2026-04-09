"use client"

import { Elements } from "@stripe/react-stripe-js"
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js"
import { type ReactNode } from "react"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface StripeProviderProps {
  children: ReactNode
  clientSecret?: string
}

export function StripeProvider({ children, clientSecret }: StripeProviderProps) {
  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#fe3a10",
        colorBackground: "#ffffff",
        colorText: "#18181b",
        colorDanger: "#ef4444",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        borderRadius: "0.625rem",
        spacingUnit: "4px",
      },
      rules: {
        ".Input": {
          border: "1px solid #d4d4d8",
          boxShadow: "none",
          padding: "12px",
        },
        ".Input:focus": {
          border: "1px solid #fe3a10",
          boxShadow: "0 0 0 1px rgba(254,58,16,0.5)",
        },
        ".Input--invalid": {
          border: "1px solid #ef4444",
        },
        ".Label": {
          fontWeight: "500",
          marginBottom: "8px",
        },
        ".Error": {
          color: "#ef4444",
          fontSize: "14px",
        },
      },
    },
  }

  if (!clientSecret) {
    return <>{children}</>
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  )
}
