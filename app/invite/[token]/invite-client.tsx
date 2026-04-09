"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { acceptTeamInvitation } from "@/app/actions/teams"
import {
  Trophy,
  Users,
  Check,
  X,
  AlertCircle,
  Loader2,
  UserCheck,
  ArrowRight,
  UserPlus,
  LogIn,
} from "lucide-react"

interface InviteClientProps {
  status: "valid" | "invalid" | "already_accepted" | "rejected" | "wrong_role" | "already_member" | "unauthenticated"
  message?: string
  teamName?: string
  token?: string
  invitation?: {
    id: string
    teamName: string
    inviterName: string
    inviterEmail: string
  }
  userId?: string
  userEmail?: string
}

export function InviteClient({
  status,
  message,
  teamName,
  token,
  invitation,
  userId,
}: InviteClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isAccepting, setIsAccepting] = useState(false)

  const handleAccept = async () => {
    if (!invitation) return

    setIsAccepting(true)
    try {
      const result = await acceptTeamInvitation(invitation.id)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Welcome to the team!",
          description: `You have successfully joined ${invitation.teamName}.`,
        })
        router.push("/runner/teams")
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to accept invitation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAccepting(false)
    }
  }

  const Header = () => (
    <header className="w-full border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Trophy className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">IRL</span>
        </Link>
      </div>
    </header>
  )

  const Footer = () => (
    <footer className="border-t border-border py-4">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        Copyright {new Date().getFullYear()} Infinite Running League. All rights reserved.
      </div>
    </footer>
  )

  // Unauthenticated — show sign up / login options
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-primary/20">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Team Invitation</CardTitle>
              <CardDescription className="mt-2">
                You&apos;ve been invited to join a team!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Team</span>
                  <span className="font-semibold text-foreground">{invitation?.teamName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Invited by</span>
                  <span className="text-foreground">{invitation?.inviterName}</span>
                </div>
              </div>

              <div className="rounded-lg bg-secondary/10 p-4 text-center">
                <p className="text-sm text-foreground">
                  To accept this invitation, you need a runner account. Sign up
                  or log in to continue.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                className="w-full bg-[#FF0000] hover:bg-red-600 text-white"
                size="lg"
                asChild
              >
                <Link href={`/auth/sign-up?invite=${token}&role=runner`}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Sign Up to Join Team
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full bg-transparent"
                size="lg"
                asChild
              >
                <Link href={`/auth/login?returnUrl=${encodeURIComponent(`/invite/${token}`)}&invite=true`}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Already have an account? Log In
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
        <Footer />
      </div>
    )
  }

  // Error states
  if (status !== "valid") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                {status === "already_accepted" || status === "already_member" ? (
                  <UserCheck className="w-8 h-8 text-muted-foreground" />
                ) : status === "wrong_role" ? (
                  <AlertCircle className="w-8 h-8 text-amber-500" />
                ) : (
                  <X className="w-8 h-8 text-destructive" />
                )}
              </div>
              <CardTitle className="text-xl">
                {status === "already_accepted"
                  ? "Link Already Used"
                  : status === "already_member"
                    ? "Already a Member"
                    : status === "wrong_role"
                      ? "Cannot Accept"
                      : status === "rejected"
                        ? "Invitation Declined"
                        : "Invalid Invitation"}
              </CardTitle>
              <CardDescription className="mt-2">{message}</CardDescription>
            </CardHeader>
            {teamName && (
              <CardContent>
                <div className="rounded-lg bg-muted/50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">Team</p>
                  <p className="font-semibold text-foreground">{teamName}</p>
                </div>
              </CardContent>
            )}
            <CardFooter className="flex justify-center">
              <Button asChild>
                <Link href="/runner/dashboard">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
        <Footer />
      </div>
    )
  }

  // Valid invitation — logged in runner
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Team Invitation</CardTitle>
            <CardDescription className="mt-2">
              You&apos;ve been invited to join a team!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Team</span>
                <span className="font-semibold text-foreground">{invitation?.teamName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Invited by</span>
                <span className="text-foreground">{invitation?.inviterName}</span>
              </div>
            </div>

            <div className="rounded-lg bg-secondary/10 p-4 text-center">
              <p className="text-sm text-foreground">
                By accepting this invitation, you will become a member of this team
                and can participate in team races.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              onClick={handleAccept}
              disabled={isAccepting}
              className="w-full bg-[#FF0000] hover:bg-red-600 text-white"
              size="lg"
            >
              {isAccepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining Team...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Accept & Join Team
                </>
              )}
            </Button>
            <Button
              variant="outline"
              asChild
              className="w-full bg-transparent"
            >
              <Link href="/runner/dashboard">
                Maybe Later
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  )
}
