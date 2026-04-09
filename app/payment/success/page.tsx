import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function PaymentSuccessPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container-responsive section-spacing">
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-secondary/10 p-4">
              <CheckCircle2 className="h-12 w-12 text-secondary" />
            </div>
            <h1 className="mt-6 text-2xl font-semibold text-foreground">Payment Successful!</h1>
            <p className="mt-2 text-center text-muted-foreground">
              Your race registration has been confirmed. You will receive a confirmation email shortly.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="outline">
                <Link href="/manager/payments">
                  View Payments
                </Link>
              </Button>
              <Button asChild>
                <Link href="/manager/races">
                  View Races
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
