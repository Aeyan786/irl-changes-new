import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, ArrowLeft } from "lucide-react"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-secondary" />
          </div>
          <CardTitle className="text-2xl font-semibold">Check your email</CardTitle>
          <CardDescription className="text-muted-foreground">
            We sent you a verification link
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Click the link in your email to verify your account and complete the signup process.
            </p>
            <p className="text-sm text-muted-foreground">
              The link will expire in 24 hours.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Didn&apos;t receive the email?</p>
            <p>Check your spam folder, or make sure you entered the correct email address.</p>
          </div>

          <Button variant="outline" className="w-full bg-transparent" asChild>
            <Link href="/auth/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
