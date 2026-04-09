"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  CreditCard,
  Users,
  DollarSign,
} from "lucide-react";
import { StripeProvider } from "./stripe-provider";
import { getOrCreateCsrfToken } from "@/app/actions/csrf";
import Link from "next/link";

interface CheckoutFormProps {
  registrationId: string;
  teamName?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface PaymentDetails {
  clientSecret: string;
  amount: number;
  runnerCount: number;
  pricePerRunner: number;
}

type PaymentStatus =
  | "idle"
  | "loading"
  | "ready"
  | "processing"
  | "succeeded"
  | "failed";

export function CheckoutForm({
  registrationId,
  teamName,
  onSuccess,
  onCancel,
}: CheckoutFormProps) {
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(
    null,
  );
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Fetch CSRF token and create payment intent
  useEffect(() => {
    async function initializePayment() {
      setStatus("loading");
      setErrorMessage(null);

      try {
        // Get CSRF token
        const token = await getOrCreateCsrfToken();
        setCsrfToken(token);

        // Create payment intent
        const response = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": token,
          },
          body: JSON.stringify({ registrationId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to create payment intent");
        }

        setPaymentDetails(data);
        setStatus("ready");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "An error occurred",
        );
        setStatus("failed");
      }
    }

    initializePayment();
  }, [registrationId]);

  if (status === "loading") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Preparing payment...</p>
        </CardContent>
      </Card>
    );
  }

  if (status === "failed" && !paymentDetails) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="py-8">
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Payment Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={onCancel}>
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!paymentDetails) {
    return null;
  }

  return (
    <StripeProvider clientSecret={paymentDetails.clientSecret}>
      <PaymentFormContent
        paymentDetails={paymentDetails}
        teamName={teamName}
        csrfToken={csrfToken}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </StripeProvider>
  );
}

interface PaymentFormContentProps {
  paymentDetails: PaymentDetails;
  teamName?: string;
  csrfToken: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function PaymentFormContent({
  paymentDetails,
  teamName,
  onSuccess,
  onCancel,
}: PaymentFormContentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState<PaymentStatus>("ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (!stripe || !elements) {
        return;
      }

      setStatus("processing");
      setErrorMessage(null);

      try {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/payment/success`,
          },
          redirect: "if_required",
        });

        if (error) {
          setErrorMessage(error.message || "Payment failed");
          setStatus("failed");
        } else if (paymentIntent && paymentIntent.status === "succeeded") {
          setStatus("succeeded");
          onSuccess?.();
        } else {
          setStatus("ready");
        }
      } catch (error) {
        setErrorMessage("An unexpected error occurred");
        setStatus("failed");
      }
    },
    [stripe, elements, onSuccess],
  );

  if (status === "succeeded") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-secondary/10 p-4">
            <CheckCircle2 className="h-12 w-12 text-secondary" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-foreground">
            Payment Successful!
          </h2>
          <p className="mt-2 text-center text-muted-foreground">
            Your registration has been confirmed. You will receive a
            confirmation email shortly.
          </p>
          <Link href="/">
            <Button className="mt-8" onClick={onSuccess}>
              Continue
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Complete Payment
        </CardTitle>
        {teamName && (
          <CardDescription>Registration payment for {teamName}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Payment Summary */}
        <div className="rounded-lg bg-muted p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              Runners
            </span>
            <span className="font-medium">{paymentDetails.runnerCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Price per runner</span>
            <span>{formatCurrency(paymentDetails.pricePerRunner)}</span>
          </div>
          <div className="border-t border-border pt-3 flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold">
              <DollarSign className="h-4 w-4" />
              Total
            </span>
            <span className="text-lg font-bold text-primary">
              {formatCurrency(paymentDetails.amount)}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Payment Failed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Stripe Payment Element */}
        <form onSubmit={handleSubmit} id="payment-form">
          <PaymentElement
            options={{
              layout: "tabs",
            }}
          />
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-3 sm:flex-row">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto bg-transparent"
            onClick={onCancel}
            disabled={status === "processing"}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          form="payment-form"
          variant="accent"
          className="w-full sm:flex-1"
          disabled={!stripe || !elements || status === "processing"}
        >
          {status === "processing" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay ${formatCurrency(paymentDetails.amount)}`
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
