"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import {
  acceptTeamInvitation,
  rejectTeamInvitation,
} from "@/app/actions/teams"
import {
  acceptAmInvitation,
  rejectAmInvitation,
} from "@/app/actions/assistant-manager"
import {
  sendTeamInviteByEmail,
  generateTeamInviteLink,
  cancelInvitation,
  resendInvitation,
} from "@/app/actions/invitations"
import {
  Mail,
  Users,
  Check,
  X,
  Clock,
  Loader2,
  Copy,
  Link as LinkIcon,
  Send,
  RefreshCw,
  Trash2,
  Inbox,
  SendHorizontal,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"

interface Team {
  id: string
  name: string
  manager_id: string
}

interface TeamMember {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

interface ReceivedInvitation {
  id: string
  from_user_id: string
  to_user_id: string | null
  to_email: string | null
  team_id: string
  status: string
  type: string
  invite_link: string | null
  created_at: string
  team: Team | null
  from_user: TeamMember | null
}

interface AmInvitation {
  id: string
  from_user_id: string
  team_id: string
  status: string
  created_at: string
  team: Team | null
  from_user: TeamMember | null
}

interface SentInvitation {
  id: string
  from_user_id: string
  to_user_id: string | null
  to_email: string | null
  team_id: string
  status: string
  type: string
  invite_link: string | null
  created_at: string
  team: { id: string; name: string } | null
  to_user: TeamMember | null
}

interface MyTeam {
  id: string
  name: string
  manager_id: string
  members: string[] | null
}

interface InvitationsClientProps {
  userId: string
  userEmail: string
  receivedInvitations: ReceivedInvitation[]
  amInvitations: AmInvitation[]
  sentInvitations: SentInvitation[]
  myTeams: MyTeam[]
}

export function InvitationsClient({
  userId,
  receivedInvitations,
  amInvitations,
  sentInvitations,
  myTeams,
}: InvitationsClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<string>("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [generatedLink, setGeneratedLink] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("runner-invitations")
      .on("postgres_changes", { event: "*", schema: "public", table: "invitations", filter: `to_user_id=eq.${userId}` },
        (payload) => {
          router.refresh()
          if (payload.eventType === "INSERT") {
            toast({ title: "New Invitation", description: "You have received a new invitation!" })
          }
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "invitations", filter: `from_user_id=eq.${userId}` },
        () => router.refresh()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, router, toast])

  const handleAcceptInvitation = async (invitationId: string) => {
    setProcessingId(invitationId)
    try {
      const result = await acceptTeamInvitation(invitationId)
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Welcome to the team!", description: `You have joined ${result.teamName}.` })
      }
    } catch {
      toast({ title: "Error", description: "Failed to accept invitation", variant: "destructive" })
    } finally { setProcessingId(null) }
  }

  const handleRejectInvitation = async (invitationId: string) => {
    setProcessingId(invitationId)
    try {
      const result = await rejectTeamInvitation(invitationId)
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Invitation declined", description: "You have declined the team invitation." })
      }
    } catch {
      toast({ title: "Error", description: "Failed to reject invitation", variant: "destructive" })
    } finally { setProcessingId(null) }
  }

  const handleAcceptAmInvitation = async (invitationId: string) => {
    setProcessingId(invitationId)
    try {
      const result = await acceptAmInvitation(invitationId)
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Role accepted!", description: `You are now an Assistant Manager for ${result.teamName}.` })
        router.refresh()
      }
    } catch {
      toast({ title: "Error", description: "Failed to accept role", variant: "destructive" })
    } finally { setProcessingId(null) }
  }

  const handleRejectAmInvitation = async (invitationId: string) => {
    setProcessingId(invitationId)
    try {
      const result = await rejectAmInvitation(invitationId)
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Role declined", description: "You have declined the assistant manager role." })
        router.refresh()
      }
    } catch {
      toast({ title: "Error", description: "Failed to decline role", variant: "destructive" })
    } finally { setProcessingId(null) }
  }

  const handleSendInvite = async () => {
    if (!selectedTeam || !inviteEmail) {
      toast({ title: "Error", description: "Please select a team and enter an email address", variant: "destructive" })
      return
    }
    setIsSending(true)
    try {
      const result = await sendTeamInviteByEmail(selectedTeam, inviteEmail)
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Invitation sent!", description: `Invitation sent to ${inviteEmail} for team "${result.teamName}".` })
        setSendDialogOpen(false)
        setInviteEmail("")
        setSelectedTeam("")
      }
    } catch {
      toast({ title: "Error", description: "Failed to send invitation", variant: "destructive" })
    } finally { setIsSending(false) }
  }

  const handleGenerateLink = async () => {
    if (!selectedTeam) {
      toast({ title: "Error", description: "Please select a team", variant: "destructive" })
      return
    }
    setIsGenerating(true)
    try {
      const result = await generateTeamInviteLink(selectedTeam)
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      } else {
        setGeneratedLink(result.inviteLink || "")
        toast({ title: "Link generated!", description: `Invite link created for team "${result.teamName}".` })
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate link", variant: "destructive" })
    } finally { setIsGenerating(false) }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink)
      toast({ title: "Copied!", description: "Invite link copied to clipboard." })
    } catch {
      toast({ title: "Error", description: "Failed to copy link", variant: "destructive" })
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    setProcessingId(invitationId)
    try {
      const result = await cancelInvitation(invitationId)
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Invitation cancelled", description: "The invitation has been cancelled." })
      }
    } catch {
      toast({ title: "Error", description: "Failed to cancel invitation", variant: "destructive" })
    } finally { setProcessingId(null) }
  }

  const handleResendInvitation = async (invitationId: string) => {
    setProcessingId(invitationId)
    try {
      const result = await resendInvitation(invitationId)
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Reminder sent", description: `Reminder sent for team "${result.teamName}".` })
      }
    } catch {
      toast({ title: "Error", description: "Failed to resend invitation", variant: "destructive" })
    } finally { setProcessingId(null) }
  }

  const getInitials = (firstName: string | null, lastName: string | null) =>
    `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?"

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs whitespace-nowrap">
            <Clock className="h-3 w-3 mr-1" /> Pending
          </Badge>
        )
      case "accepted":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs whitespace-nowrap">
            <Check className="h-3 w-3 mr-1" /> Accepted
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="destructive" className="text-xs whitespace-nowrap">
            <X className="h-3 w-3 mr-1" /> Declined
          </Badge>
        )
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>
    }
  }

  const totalReceivedCount = receivedInvitations.length + amInvitations.length

  return (
    <div className="space-y-5 sm:space-y-6 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto w-full">

      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Invitations</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage team invitations you&apos;ve received and sent
          </p>
        </div>

        <div className="flex flex-col xs:flex-row gap-2 w-full sm:w-auto">
          {/* Send Invite Dialog */}
          <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="w-full sm:w-auto bg-[#FF0000] text-white hover:bg-[#FF0000] hover:shadow-xl cursor-pointer text-sm"
                disabled={myTeams.length === 0}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Invite
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-sm sm:max-w-md rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Send Team Invitation</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Invite someone to join your team by email
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3 sm:py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="team" className="text-sm">Select Team</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger className="h-9 sm:h-10 text-sm">
                      <SelectValue placeholder="Choose a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {myTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id} className="text-sm">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {team.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="runner@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setSendDialogOpen(false)} className="w-full sm:w-auto bg-transparent text-sm">
                  Cancel
                </Button>
                <Button onClick={handleSendInvite} disabled={isSending || !selectedTeam || !inviteEmail} className="w-full sm:w-auto text-sm">
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Get Link Button */}
          <Dialog open={linkDialogOpen} onOpenChange={(open) => {
            setLinkDialogOpen(open)
            if (!open) { setGeneratedLink(""); setSelectedTeam("") }
          }}>
            <DialogTrigger asChild>
              <Link href="/auth/login" className="w-full sm:w-auto">
                <Button variant="outline" disabled={myTeams.length === 0} className="w-full sm:w-auto bg-transparent cursor-pointer text-sm">
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Get Link
                </Button>
              </Link>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-sm sm:max-w-md rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Generate Invite Link</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Create a shareable link for anyone to join your team
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3 sm:py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="team-link" className="text-sm">Select Team</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger className="h-9 sm:h-10 text-sm">
                      <SelectValue placeholder="Choose a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {myTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id} className="text-sm">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {team.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!generatedLink && (
                  <Button onClick={handleGenerateLink} disabled={isGenerating || !selectedTeam} className="w-full text-sm">
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                    Generate Link
                  </Button>
                )}
                {generatedLink && (
                  <div className="space-y-2">
                    <Label className="text-sm">Your Invite Link</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={generatedLink} className="bg-muted text-xs sm:text-sm h-9" />
                      <Button size="icon" variant="outline" onClick={handleCopyLink} className="bg-transparent shrink-0 h-9 w-9">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share this link with anyone you want to invite to your team
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLinkDialogOpen(false)} className="w-full sm:w-auto bg-transparent text-sm">
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* No Teams Warning */}
      {myTeams.length === 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="pt-4 pb-4 sm:pt-6">
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm sm:text-base text-amber-800 dark:text-amber-200">
                  You&apos;re not part of any team yet
                </p>
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Join a team first to send invitations to other runners.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="received" className="w-full">
        <TabsList className="w-full max-w-xs sm:max-w-md grid grid-cols-2">
          <TabsTrigger value="received" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm">
            <Inbox className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Received</span>
            {totalReceivedCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-4 px-1.5">
                {totalReceivedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm">
            <SendHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Sent</span>
          </TabsTrigger>
        </TabsList>

        {/* Received Tab */}
        <TabsContent value="received" className="mt-4 sm:mt-6 space-y-6">

          {/* AM Invitations Section */}
          {amInvitations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-orange-500" />
                <h2 className="text-sm font-semibold text-foreground">Assistant Manager Invitations</h2>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">{amInvitations.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {amInvitations.map((invitation) => (
                  <Card key={invitation.id} className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
                    <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
                      <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-orange-500 shrink-0" />
                        <span className="truncate">Assistant Manager Role</span>
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        <span className="font-medium">{invitation.team?.name || "Unknown Team"}</span>
                        <br />
                        Offered by {invitation.from_user?.first_name || "Manager"}{" "}
                        {invitation.from_user?.last_name || ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 sm:px-6 pb-4">
                      <div className="flex flex-col gap-3">
                        <p className="text-xs text-muted-foreground">
                          Accepting this role will give you access to the manager portal to help manage runners and view payments.
                        </p>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-8 sm:h-9 text-xs sm:text-sm bg-orange-500 hover:bg-orange-600"
                            onClick={() => handleAcceptAmInvitation(invitation.id)}
                            disabled={processingId === invitation.id}
                          >
                            {processingId === invitation.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <><Check className="h-3.5 w-3.5 mr-1" /> Accept</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8 sm:h-9 text-xs sm:text-sm bg-transparent"
                            onClick={() => handleRejectAmInvitation(invitation.id)}
                            disabled={processingId === invitation.id}
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> Decline
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Team Join Invitations Section */}
          <div>
            {amInvitations.length > 0 && receivedInvitations.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <Mail className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Team Invitations</h2>
                <Badge variant="secondary" className="text-xs">{receivedInvitations.length}</Badge>
              </div>
            )}
            {receivedInvitations.length === 0 && amInvitations.length === 0 ? (
              <Card className="bg-muted/30">
                <CardContent className="py-10 sm:py-12 text-center">
                  <Inbox className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm sm:text-base text-muted-foreground">No pending invitations</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    When someone invites you to a team, it will appear here
                  </p>
                </CardContent>
              </Card>
            ) : receivedInvitations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {receivedInvitations.map((invitation) => (
                  <Card key={invitation.id} className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
                      <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">{invitation.team?.name || "Unknown Team"}</span>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 text-xs sm:text-sm">
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarFallback className="text-xs bg-primary/20">
                            {getInitials(invitation.from_user?.first_name || null, invitation.from_user?.last_name || null)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">
                          Invited by {invitation.from_user?.first_name || "Someone"}{" "}
                          {invitation.from_user?.last_name || ""}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 sm:px-6 pb-4">
                      <div className="flex flex-col gap-3">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                            onClick={() => handleAcceptInvitation(invitation.id)}
                            disabled={processingId === invitation.id}
                          >
                            {processingId === invitation.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <><Check className="h-3.5 w-3.5 mr-1" /> Accept</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8 sm:h-9 text-xs sm:text-sm bg-transparent"
                            onClick={() => handleRejectInvitation(invitation.id)}
                            disabled={processingId === invitation.id}
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> Decline
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}
          </div>
        </TabsContent>

        {/* Sent Tab */}
        <TabsContent value="sent" className="mt-4 sm:mt-6">
          {sentInvitations.length === 0 ? (
            <Card className="bg-muted/30">
              <CardContent className="py-10 sm:py-12 text-center">
                <SendHorizontal className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm sm:text-base text-muted-foreground">No invitations sent</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Invitations you send will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile + Tablet: Cards */}
              <div className="lg:hidden space-y-3">
                {sentInvitations.map((invitation) => (
                  <Card key={invitation.id}>
                    <CardContent className="px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {invitation.to_user ? (
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="h-6 w-6 shrink-0">
                                  <AvatarFallback className="text-xs">
                                    {getInitials(invitation.to_user.first_name, invitation.to_user.last_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {invitation.to_user.first_name} {invitation.to_user.last_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">{invitation.to_user.email}</p>
                                </div>
                              </div>
                            ) : invitation.to_email ? (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-sm truncate">{invitation.to_email}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-sm text-muted-foreground">Shareable Link</span>
                              </div>
                            )}
                            {getStatusBadge(invitation.status)}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {invitation.team?.name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(invitation.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {invitation.status === "pending" && (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleResendInvitation(invitation.id)}
                              disabled={processingId === invitation.id}
                              title="Resend"
                            >
                              {processingId === invitation.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleCancelInvitation(invitation.id)}
                              disabled={processingId === invitation.id}
                              title="Cancel"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop: Table */}
              <Card className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sentInvitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {invitation.to_user ? (
                              <>
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarFallback className="text-xs">
                                    {getInitials(invitation.to_user.first_name, invitation.to_user.last_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {invitation.to_user.first_name} {invitation.to_user.last_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">{invitation.to_user.email}</p>
                                </div>
                              </>
                            ) : invitation.to_email ? (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm">{invitation.to_email}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm text-muted-foreground">Shareable Link</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                            {invitation.team?.name}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {invitation.status === "pending" && (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleResendInvitation(invitation.id)}
                                disabled={processingId === invitation.id}
                              >
                                {processingId === invitation.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <RefreshCw className="h-4 w-4" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCancelInvitation(invitation.id)}
                                disabled={processingId === invitation.id}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
