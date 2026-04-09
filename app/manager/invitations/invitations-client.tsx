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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import {
  sendTeamInviteByEmail,
  generateTeamInviteLink,
  cancelInvitation,
  resendInvitation,
} from "@/app/actions/invitations"
import { acceptJoinRequest, rejectJoinRequest } from "@/app/actions/teams"
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
  UserPlus,
  Inbox,
  SendHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

interface TeamMember {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  gender: string | null
  age: number | null
}

interface Team {
  id: string
  name: string
  manager_id: string
  members: string[] | null
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

interface JoinRequest {
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
  from_user: TeamMember | null
}

interface InvitationsClientProps {
  teams: Team[]
  sentInvitations: SentInvitation[]
  joinRequests: JoinRequest[]
  managerId: string
  managerEmail: string
}

const ITEMS_PER_PAGE = 10

export function InvitationsClient({
  teams,
  sentInvitations,
  joinRequests,
  managerId,
}: InvitationsClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [invitationToCancel, setInvitationToCancel] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string>("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [generatedLink, setGeneratedLink] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Pagination state
  const [sentPage, setSentPage] = useState(1)
  const [requestsPage, setRequestsPage] = useState(1)

  // Real-time subscription for invitation updates
  useEffect(() => {
    const supabase = createClient()
    
    // Subscribe to invitation changes for manager's invitations
    const channel = supabase
      .channel("manager-invitations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invitations",
          filter: `from_user_id=eq.${managerId}`,
        },
        (payload) => {
          console.log("[v0] Manager invitation change:", payload.eventType)
          router.refresh()
          if (payload.eventType === "UPDATE" && (payload.new as { status?: string })?.status === "accepted") {
            toast({
              title: "Invitation Accepted!",
              description: "A runner has joined your team.",
            })
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invitations",
          filter: `to_user_id=eq.${managerId}`,
        },
        (payload) => {
          console.log("[v0] Join request change:", payload.eventType)
          router.refresh()
          if (payload.eventType === "INSERT") {
            toast({
              title: "New Join Request",
              description: "A runner wants to join your team!",
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [managerId, router, toast])

  // Filter invitations by status
  const pendingInvitations = sentInvitations.filter((i) => i.status === "pending")
  const completedInvitations = sentInvitations.filter((i) => i.status !== "pending")

  // Paginate sent invitations
  const paginatedSent = sentInvitations.slice(
    (sentPage - 1) * ITEMS_PER_PAGE,
    sentPage * ITEMS_PER_PAGE
  )
  const totalSentPages = Math.ceil(sentInvitations.length / ITEMS_PER_PAGE)

  // Paginate join requests
  const paginatedRequests = joinRequests.slice(
    (requestsPage - 1) * ITEMS_PER_PAGE,
    requestsPage * ITEMS_PER_PAGE
  )
  const totalRequestsPages = Math.ceil(joinRequests.length / ITEMS_PER_PAGE)

  const handleSendInvite = async () => {
    if (!selectedTeam || !inviteEmail) {
      toast({
        title: "Error",
        description: "Please select a team and enter an email address",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    try {
      const result = await sendTeamInviteByEmail(selectedTeam, inviteEmail)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Invitation sent!",
          description: `Invitation sent to ${inviteEmail} for team "${result.teamName}".`,
        })
        setSendDialogOpen(false)
        setInviteEmail("")
        setSelectedTeam("")
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleGenerateLink = async () => {
    if (!selectedTeam) {
      toast({
        title: "Error",
        description: "Please select a team",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateTeamInviteLink(selectedTeam)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        setGeneratedLink(result.inviteLink || "")
        toast({
          title: "Link generated!",
          description: `Invite link created for team "${result.teamName}".`,
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate link",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink)
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard.",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      })
    }
  }

  const handleCancelInvitation = async () => {
    if (!invitationToCancel) return

    setProcessingId(invitationToCancel)
    try {
      const result = await cancelInvitation(invitationToCancel)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Invitation cancelled",
          description: "The invitation has been cancelled.",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
      setCancelDialogOpen(false)
      setInvitationToCancel(null)
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    setProcessingId(invitationId)
    try {
      const result = await resendInvitation(invitationId)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Reminder sent",
          description: `Reminder sent for team "${result.teamName}".`,
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to resend invitation",
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleAcceptRequest = async (invitationId: string) => {
    setProcessingId(invitationId)
    try {
      const result = await acceptJoinRequest(invitationId)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Request accepted",
          description: `Runner has been added to ${result.teamName}.`,
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to accept request",
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectRequest = async (invitationId: string) => {
    setProcessingId(invitationId)
    try {
      const result = await rejectJoinRequest(invitationId)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Request declined",
          description: "The join request has been declined.",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to decline request",
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const getInitials = (firstName: string | null, lastName: string | null) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?"
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      case "accepted":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <Check className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="destructive">
            <X className="h-3 w-3 mr-1" />
            Declined
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
  }: {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
  }) => {
    if (totalPages <= 1) return null

    return (
      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="bg-transparent"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="bg-transparent"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Invitations</h1>
          <p className="text-muted-foreground mt-1">
            Manage team invitations and join requests
          </p>
        </div>
        <div className="flex gap-2">
          {/* Send Invite Dialog */}
          <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer" disabled={teams.length === 0}>
                <Mail className="h-4 w-4 mr-2" />
                Invite Runner
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Runner to Team</DialogTitle>
                <DialogDescription>
                  Send an invitation to a runner by email
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="team">Select Team</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger className="cursor-pointer w-full">
                      <SelectValue placeholder="Choose a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {team.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Runner Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="runner@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSendDialogOpen(false)} className="bg-transparent cursor-pointer">
                  Cancel
                </Button>
                <Button className="bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer" onClick={handleSendInvite} disabled={isSending || !selectedTeam || !inviteEmail}>
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Generate Link Dialog */}
          <Dialog open={linkDialogOpen} onOpenChange={(open) => {
            setLinkDialogOpen(open)
            if (!open) {
              setGeneratedLink("")
              setSelectedTeam("")
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={teams.length === 0} className="bg-white cursor-pointer">
                <LinkIcon className="h-4 w-4 mr-2" />
                Get Link
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Generate Invite Link</DialogTitle>
                <DialogDescription>
                  Create a shareable link for runners to join your team
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="team-link">Select Team</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger className="cursor-pointer w-full">
                      <SelectValue placeholder="Choose a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
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
                  <Button 
                    onClick={handleGenerateLink} 
                    variant={'outline'}
                    disabled={isGenerating || !selectedTeam}
                    className="w-full bg-white cursor-pointer"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <LinkIcon className="h-4 w-4 mr-2" />
                    )}
                    Generate Link
                  </Button>
                )}

                {generatedLink && (
                  <div className="space-y-2">
                    <Label>Invite Link</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={generatedLink}
                        className="bg-muted"
                      />
                      <Button size="icon" variant="outline" onClick={handleCopyLink} className="bg-transparent">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share this link with runners you want to invite
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLinkDialogOpen(false)} className="bg-transparent cursor-pointer">
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* No Teams Warning */}
      {teams.length === 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  No teams created yet
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Create a team first to start inviting runners.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{pendingInvitations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Join Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{joinRequests.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{sentInvitations.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sent" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <SendHorizontal className="h-4 w-4" />
            Sent Invitations
            {pendingInvitations.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingInvitations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Join Requests
            {joinRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {joinRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Sent Invitations Tab */}
        <TabsContent value="sent" className="mt-6">
          {sentInvitations.length === 0 ? (
            <Card className="bg-muted/30">
              <CardContent className="py-12 text-center">
                <SendHorizontal className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No invitations sent yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "Invite Runner" to send your first invitation
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Sent Invitations</CardTitle>
                <CardDescription>
                  Track all invitations you have sent to runners
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead className="hidden sm:table-cell">Team</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Sent</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSent.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs bg-primary/20">
                                  {invitation.to_user
                                    ? getInitials(invitation.to_user.first_name, invitation.to_user.last_name)
                                    : invitation.to_email?.[0]?.toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground">
                                  {invitation.to_user
                                    ? `${invitation.to_user.first_name || ""} ${invitation.to_user.last_name || ""}`.trim() || invitation.to_email
                                    : invitation.to_email || "Invite Link"}
                                </p>
                                {invitation.to_user && (
                                  <p className="text-xs text-muted-foreground">{invitation.to_user.email}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-foreground">{invitation.team?.name || "Unknown"}</span>
                          </TableCell>
                          <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {new Date(invitation.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {invitation.status === "pending" && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="cursor-pointer"
                                  onClick={() => handleResendInvitation(invitation.id)}
                                  disabled={processingId === invitation.id}
                                >
                                  {processingId === invitation.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                  <span className="sr-only">Resend</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive cursor-pointer"
                                  onClick={() => {
                                    setInvitationToCancel(invitation.id)
                                    setCancelDialogOpen(true)
                                  }}
                                  disabled={processingId === invitation.id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Cancel</span>
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls
                  currentPage={sentPage}
                  totalPages={totalSentPages}
                  onPageChange={setSentPage}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Join Requests Tab */}
        <TabsContent value="requests" className="mt-6">
          {joinRequests.length === 0 ? (
            <Card className="bg-muted/30">
              <CardContent className="py-12 text-center">
                <UserPlus className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No pending join requests</p>
                <p className="text-sm text-muted-foreground mt-1">
                  When runners request to join your teams, they will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Join Requests</CardTitle>
                <CardDescription>
                  Runners requesting to join your teams
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Runner</TableHead>
                        <TableHead className="hidden sm:table-cell">Team</TableHead>
                        <TableHead className="hidden md:table-cell">Gender</TableHead>
                        <TableHead className="hidden md:table-cell">Requested</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs bg-primary/20">
                                  {getInitials(
                                    request.from_user?.first_name || null,
                                    request.from_user?.last_name || null
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground">
                                  {`${request.from_user?.first_name || ""} ${request.from_user?.last_name || ""}`.trim() || "Unknown"}
                                </p>
                                <p className="text-xs text-muted-foreground">{request.from_user?.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-foreground">{request.team?.name || "Unknown"}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell capitalize text-muted-foreground">
                            {request.from_user?.gender || "-"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900"
                                onClick={() => handleAcceptRequest(request.id)}
                                disabled={processingId === request.id}
                              >
                                {processingId === request.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                                <span className="sr-only">Accept</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleRejectRequest(request.id)}
                                disabled={processingId === request.id}
                              >
                                <X className="h-4 w-4" />
                                <span className="sr-only">Reject</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls
                  currentPage={requestsPage}
                  totalPages={totalRequestsPages}
                  onPageChange={setRequestsPage}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this invitation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer bg-white">Keep Invitation</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInvitation}
              className="bg-destructive hover:bg-red-700 hover:shadow-lg cursor-pointer"
            >
              Cancel Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
