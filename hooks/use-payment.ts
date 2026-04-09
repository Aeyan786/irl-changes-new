"use client"

import { useState, useCallback } from "react"
import { getOrCreateCsrfToken } from "@/app/actions/csrf"

interface PaymentDetails {
  clientSecret: string
  amount: number
  runnerCount: number
  pricePerRunner: number
}

interface UsePaymentOptions {
  onSuccess?: (details: PaymentDetails) => void
  onError?: (error: string) => void
}

interface UsePaymentReturn {
  createPaymentIntent: (registrationId: string) => Promise<PaymentDetails | null>
  paymentDetails: PaymentDetails | null
  isLoading: boolean
  error: string | null
  reset: () => void
}

export function usePayment(options: UsePaymentOptions = {}): UsePaymentReturn {
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createPaymentIntent = useCallback(
    async (registrationId: string): Promise<PaymentDetails | null> => {
      setIsLoading(true)
      setError(null)

      try {
        // Get CSRF token
        const csrfToken = await getOrCreateCsrfToken()

        // Create payment intent
        const response = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({ registrationId }),
        })

        const data = await response.json()

        if (!response.ok) {
          const errorMessage = data.error || "Failed to create payment intent"
          setError(errorMessage)
          options.onError?.(errorMessage)
          return null
        }

        setPaymentDetails(data)
        options.onSuccess?.(data)
        return data
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred"
        setError(errorMessage)
        options.onError?.(errorMessage)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [options]
  )

  const reset = useCallback(() => {
    setPaymentDetails(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    createPaymentIntent,
    paymentDetails,
    isLoading,
    error,
    reset,
  }
}
