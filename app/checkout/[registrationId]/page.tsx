import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CheckoutForm } from "@/components/checkout-form"
import { Loader2 } from "lucide-react"

interface CheckoutPageProps {
  params: Promise<{ registrationId: string }>
}

async function CheckoutContent({ registrationId }: { registrationId: string }) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect("/auth/login?redirect=/checkout/" + registrationId)
  }

  // Fetch registration and team details
  const { data: registration, error } = await supabase
    .from("registrations")
    .select(`
      id,
      payment_status,
      teams!inner (
        id,
        name,
        manager_id
      )
    `)
    .eq("id", registrationId)
    .single()

  if (error || !registration) {
    return (
      <div className="container-responsive section-spacing">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-semibold text-foreground">Registration Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            The registration you are looking for does not exist or you do not have access to it.
          </p>
        </div>
      </div>
    )
  }

  const team = registration.teams as { id: string; name: string; manager_id: string }

  // Check if user is the team manager
  if (team.manager_id !== user.id) {
    return (
      <div className="container-responsive section-spacing">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-semibold text-foreground">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">
            Only team managers can complete payment for race registrations.
          </p>
        </div>
      </div>
    )
  }

  // Check if already paid
  if (registration.payment_status === "paid") {
    return (
      <div className="container-responsive section-spacing">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-semibold text-secondary">Already Paid</h1>
          <p className="mt-2 text-muted-foreground">
            This registration has already been paid. Thank you!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container-responsive section-spacing">
      <div className="mb-8 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Race Registration Payment</h1>
        <p className="mt-2 text-muted-foreground">
          Complete your payment to confirm your team&apos;s registration
        </p>
      </div>
      <CheckoutForm
        registrationId={registrationId}
        teamName={team.name}
      />
    </div>
  )
}

function LoadingState() {
  return (
    <div className="container-responsive section-spacing">
      <div className="flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading checkout...</p>
      </div>
    </div>
  )
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { registrationId } = await params
  
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={<LoadingState />}>
        <CheckoutContent registrationId={registrationId} />
      </Suspense>
    </main>
  )
}
