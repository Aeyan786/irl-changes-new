"use client"
import Link from "next/link"
import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import {
  acceptTeamInvitation,
  rejectTeamInvitation,
  requestToJoinTeam,
  leaveTeam,
} from "@/app/actions/teams"
import {
  Mail,
  Users,
  UserPlus,
  Check,
  X,
  Clock,
  LogOut,
  Crown,
  Loader2,
  User,
  Send,
  GraduationCap,
  Trophy,
  CalendarDays,
  MapPin,
} from "lucide-react"
import { TeamLogo } from "@/components/team-logo"

interface TeamMember {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  gender: string | null
  age: number | null
  past_achievements: string | null
}

interface Registration {
  id: string
  status: string
  created_at: string
  race: {
    id: string
    name: string
    date: string
    location?: string | null
  } | null
}

interface Team {
  id: string
  name: string
  manager_id: string
  members: string[]
  details?: string | null
  is_high_school?: boolean
  logo_url?: string | null
  created_at: string
  updated_at?: string | null
  manager: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
  memberDetails?: TeamMember[]
  registrations?: Registration[]
}

interface Invitation {
  id: string
  from_user_id: string
  to_user_id: string | null
  to_email: string | null
  team_id: string
  status: string
  type: string
  created_at: string
  team: {
    id: string
    name: string
    manager_id: string
  } | null
  from_user: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

interface TeamsClientProps {
  invitations: Invitation[]
  myTeams: Team[]
  otherTeams: Team[]
  pendingTeamIds: string[]
  userId: string
  currentTeamId: string | null
}

const getRegistrationStatusBadge = (status: string) => {
  switch (status) {
    case "confirmed":
    case "paid":
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Confirmed</Badge>
    case "pending":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Pending</Badge>
    case "cancelled":
      return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Cancelled</Badge>
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>
  }
}

export function TeamsClient({
  invitations,
  myTeams,
  otherTeams,
  pendingTeamIds,
  userId,
  currentTeamId,
}: TeamsClientProps) {
  const isAlreadyInTeam = currentTeamId !== null
  const { toast } = useToast()
  const [processingInvite, setProcessingInvite] = useState<string | null>(null)
  const [requestingTeam, setRequestingTeam] = useState<string | null>(null)
  const [leavingTeam, setLeavingTeam] = useState<string | null>(null)
  const [joinDialogOpen, setJoinDialogOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [joinMessage, setJoinMessage] = useState("")
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [teamToLeave, setTeamToLeave] = useState<Team | null>(null)

  const handleAcceptInvitation = async (invitationId: string) => {
    if (isAlreadyInTeam) {
      toast({
        title: "Already in a team",
        description: "You are already in a team. Leave it first before joining another.",
        variant: "destructive",
      })
      return
    }

    setProcessingInvite(invitationId)
    try {
      const result = await acceptTeamInvitation(invitationId)
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Welcome to the team!", description: `You have joined ${result.teamName}.` })
      }
    } catch {
      toast({ title: "Error", description: "Failed to accept invitation", variant: "destructive" })
    } finally {
      setProcessingInvite(null)
    }
  }

  const handleRejectInvitation = async (invitationId: string) => {
    setProcessingInvite(invitationId)
    try {
      const result = await rejectTeamInvitation(invitationId)
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Invitation declined", description: "You have declined the team invitation." })
      }
    } catch {
      toast({ title: "Error", description: "Failed to reject invitation", variant: "destructive" })
    } finally {
      setProcessingInvite(null)
    }
  }

  const openJoinDialog = (team: Team) => {
    if (isAlreadyInTeam) {
      toast({
        title: "Already in a team",
        description: "You are already in a team. Leave it first before requesting to join another.",
        variant: "destructive",
      })
      return
    }
    setSelectedTeam(team)
    setJoinMessage("")
    setJoinDialogOpen(true)
  }

  const handleRequestToJoin = async () => {
    if (!selectedTeam) return
    setRequestingTeam(selectedTeam.id)
    try {
      const result = await requestToJoinTeam(selectedTeam.id, joinMessage)
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Request sent", description: `Your request to join ${result.teamName} has been sent to the manager.` })
        setJoinDialogOpen(false)
      }
    } catch {
      toast({ title: "Error", description: "Failed to send join request", variant: "destructive" })
    } finally {
      setRequestingTeam(null)
    }
  }

  const openLeaveDialog = (team: Team) => {
    setTeamToLeave(team)
    setLeaveDialogOpen(true)
  }

  const handleLeaveTeam = async () => {
    if (!teamToLeave) return
    setLeavingTeam(teamToLeave.id)
    try {
      const result = await leaveTeam(teamToLeave.id)
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Left team", description: "You have left the team." })
        setLeaveDialogOpen(false)
      }
    } catch {
      toast({ title: "Error", description: "Failed to leave team", variant: "destructive" })
    } finally {
      setLeavingTeam(null)
    }
  }

  const getInitials = (firstName: string | null, lastName: string | null) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?"
  }

  const getGenderBadgeColor = (gender: string | null) => {
    switch (gender) {
      case "male": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "female": return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200"
      default: return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">My Team</h1>
        <p className="text-muted-foreground mt-1">
          View your team and connect with your teammates
        </p>
      </div>

      {/* Pending Invitations Section */}
      {invitations.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-foreground">Pending Invitations</h2>
            <Badge variant="secondary">{invitations.length}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {invitations.map((invitation) => (
              <Card key={invitation.id} className="border-primary/20 bg-primary/5 transition-theme">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {invitation.team?.name || "Unknown Team"}
                  </CardTitle>
                  <CardDescription>
                    Invited by {invitation.from_user?.first_name || "Manager"}{" "}
                    {invitation.from_user?.last_name || ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(invitation.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 cursor-pointer hover:shadow-md"
                        onClick={() => handleAcceptInvitation(invitation.id)}
                        disabled={processingInvite === invitation.id || isAlreadyInTeam}
                      >
                        {processingInvite === invitation.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <><Check className="h-4 w-4 mr-1" />Accept</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-transparent cursor-pointer hover:shadow-md"
                        onClick={() => handleRejectInvitation(invitation.id)}
                        disabled={processingInvite === invitation.id}
                      >
                        <X className="h-4 w-4 mr-1" />Decline
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* My Teams Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-semibold text-foreground">My Teams</h2>
          {myTeams.length > 0 && (
            <Badge className="rounded-full border-black/50" variant="outline">{myTeams.length}</Badge>
          )}
        </div>

        {myTeams.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="py-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">You haven&apos;t joined any teams yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Accept an invitation or request to join a team below.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {myTeams.map((team) => (
              <Card key={team.id} className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-white overflow-hidden">
                {/* Team Header */}
                <div className="bg-[#EE0505] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl overflow-hidden border-2 border-white/30 shrink-0 flex items-center justify-center bg-white/20 backdrop-blur-sm">
                        {team.logo_url ? (
                          <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover" />
                        ) : (
                          <Users className="h-6 w-6 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-xl text-white flex items-center gap-2">
                          {team.is_high_school && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <GraduationCap className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>High School Team</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {team.name}
                        </div>
                        <p className="text-red-100 text-sm">{team.memberDetails?.length || 0} members</p>
                      </div>
                    </div>
                    <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                      Your Team
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-6 space-y-5">
                  {team.details && (
                    <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">{team.details}</p>
                  )}

                  {/* Manager */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Manager</h4>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-amber-500 text-white text-xs font-semibold">
                          {getInitials(team.manager?.first_name || null, team.manager?.last_name || null)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">
                          {[team.manager?.first_name, team.manager?.last_name].filter(Boolean).join(" ") || "Team Manager"}
                        </p>
                        <p className="text-xs text-muted-foreground">{team.manager?.email}</p>
                      </div>
                      <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                    </div>
                  </div>

                  {/* Team Members */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Team Members ({team.memberDetails?.length || 0})
                    </h4>
                    <div className="space-y-2">
                      {team.memberDetails && team.memberDetails.length > 0 ? (
                        team.memberDetails.filter((m) => m.id !== team.manager_id).map((member) => (
                          <div
                            key={member.id}
                            className={`flex items-center gap-3 p-2.5 rounded-lg ${
                              member.id === userId
                                ? "bg-red-50 border border-red-200"
                                : "bg-muted/40"
                            }`}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className={`text-xs font-semibold ${member.id === userId ? "bg-red-500 text-white" : "bg-muted-foreground/20"}`}>
                                {getInitials(member.first_name, member.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {member.first_name || ""} {member.last_name || "Runner"}
                                {member.id === userId && <span className="text-xs text-red-600 ml-1.5 font-semibold">(You)</span>}
                              </p>
                              {member.past_achievements && (
                                <p className="text-xs text-muted-foreground truncate">{member.past_achievements}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {member.age && <span className="text-xs text-muted-foreground">{member.age}y</span>}
                              {member.gender && (
                                <Badge variant="outline" className={`text-xs ${getGenderBadgeColor(member.gender)}`}>
                                  {member.gender}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground py-1">No other members yet</p>
                      )}
                    </div>
                  </div>

                  {/* Race Registrations */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />Race Registrations
                    </h4>
                    {team.registrations && team.registrations.length > 0 ? (
                      <div className="space-y-2">
                        {team.registrations.map((reg) => (
                          <div key={reg.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{reg.race?.name || "Unknown Race"}</p>
                              {reg.race?.date && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <CalendarDays className="h-3 w-3" />
                                  {new Date(reg.race.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </span>
                              )}
                            </div>
                            <div className="shrink-0 ml-3">{getRegistrationStatusBadge(reg.status)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-1">No race registrations yet</p>
                    )}
                  </div>

                  {/* Leave */}
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 bg-transparent"
                      onClick={() => openLeaveDialog(team)}
                    >
                      <LogOut className="h-4 w-4 mr-2" />Leave Team
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Other Teams Section */}
      

      

      {/* Leave Team Confirmation Dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave &quot;{teamToLeave?.name}&quot;? You will need to request to rejoin if you change your mind.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)} disabled={!!leavingTeam}>Cancel</Button>
            <Button variant="destructive" onClick={handleLeaveTeam} disabled={!!leavingTeam}>
              {leavingTeam ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
              Leave Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
