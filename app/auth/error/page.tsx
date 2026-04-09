import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowLeft } from "lucide-react"

interface AuthErrorPageProps {
  searchParams: Promise<{ message?: string }>
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { message } = await searchParams
  const errorMessage = message || "An error occurred during authentication"

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-semibold">Authentication Error</CardTitle>
          <CardDescription className="text-muted-foreground">
            Something went wrong
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>

          <div className="space-y-2">
            <Button className="w-full" asChild>
              <Link href="/auth/login">
                Try again
              </Link>
            </Button>
            <Button variant="outline" className="w-full bg-transparent" asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
