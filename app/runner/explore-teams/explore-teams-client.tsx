"use client"

import Link from "next/link"
import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { requestToJoinTeam } from "@/app/actions/teams"
import {
  Users,
  Clock,
  Loader2,
  Send,
  School,
  Trophy,
  Search,
  Crown,
  CheckCircle2,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react"

const MAX_TEAM_SIZE = 10

interface TeamMember {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  gender: string | null
  age: number | null
  past_achievements: string | null
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
  manager: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
  memberDetails?: TeamMember[]
}

interface ExploreTeamsClientProps {
  teams: Team[]
  pendingTeamIds: string[]
  userId: string
  currentTeamId: string | null
}

export function ExploreTeamsClient({
  teams,
  pendingTeamIds,
  userId,
  currentTeamId,
}: ExploreTeamsClientProps) {
  const { toast } = useToast()
  const isAlreadyInTeam = currentTeamId !== null

  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "members-desc" | "members-asc" | "newest">("name")
  const [filterHighSchool, setFilterHighSchool] = useState(false)
  const [requestingTeam, setRequestingTeam] = useState<string | null>(null)
  const [sentRequests, setSentRequests] = useState<string[]>([]) // track newly sent requests
  const [joinDialogOpen, setJoinDialogOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [joinMessage, setJoinMessage] = useState("")
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)

  const getInitials = (firstName: string | null, lastName: string | null) =>
    `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?"

  const filteredTeams = useMemo(() => {
    let result = [...teams]

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (team) =>
          team.name.toLowerCase().includes(q) ||
          `${team.manager?.first_name || ""} ${team.manager?.last_name || ""}`.toLowerCase().includes(q)
      )
    }

    // High school filter
    if (filterHighSchool) {
      result = result.filter((t) => t.is_high_school)
    }

    // Sort
    switch (sortBy) {
      case "members-desc":
        result.sort((a, b) => (b.memberDetails?.length || 0) - (a.memberDetails?.length || 0))
        break
      case "members-asc":
        result.sort((a, b) => (a.memberDetails?.length || 0) - (b.memberDetails?.length || 0))
        break
      case "newest":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      default:
        result.sort((a, b) => a.name.localeCompare(b.name))
    }

    return result
  }, [teams, searchQuery, sortBy, filterHighSchool])

  const openJoinDialog = (team: Team) => {
    if (isAlreadyInTeam) {
      toast({
        title: "Already in a team",
        description: "Leave your current team first before requesting to join another.",
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
        toast({ title: "Request sent!", description: `Your request to join ${result.teamName} has been sent.` })
        setSentRequests((prev) => [...prev, selectedTeam.id])
        setJoinDialogOpen(false)
      }
    } catch {
      toast({ title: "Error", description: "Failed to send join request", variant: "destructive" })
    } finally {
      setRequestingTeam(null)
    }
  }

  const isPending = (teamId: string) =>
    pendingTeamIds.includes(teamId) || sentRequests.includes(teamId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Explore Teams</h1>
        <p className="text-muted-foreground mt-1">Browse available teams and request to join one</p>
      </div>

      {/* Already in team warning */}
      {isAlreadyInTeam && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Users className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            You are already in a team.{" "}
            <Link href="/runner/teams" className="font-semibold underline">
              Leave your current team
            </Link>{" "}
            first to join another.
          </p>
        </div>
      )}

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teams or managers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-full sm:w-44 h-10">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name (A–Z)</SelectItem>
              <SelectItem value="members-desc">Most Members</SelectItem>
              <SelectItem value="members-asc">Fewest Members</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Filter:</span>
          <button
            onClick={() => setFilterHighSchool(!filterHighSchool)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              filterHighSchool
                ? "bg-accent text-white border-accent"
                : "bg-background border-border text-muted-foreground hover:border-accent/50"
            }`}
          >
            <School className="h-3 w-3" />
            High School Only
          </button>
        </div>
      </div>

      {/* Stats */}
      <p className="text-sm text-muted-foreground">
        {filteredTeams.length} team{filteredTeams.length !== 1 ? "s" : ""} available
      </p>

      {/* Teams list */}
      {filteredTeams.length === 0 ? (
        <Card className="bg-muted/30">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-foreground font-semibold text-lg">
              {searchQuery ? "No teams found" : "No teams available"}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              {searchQuery
                ? `No teams match "${searchQuery}". Try a different search term.`
                : filterHighSchool
                ? "No high school teams are available right now."
                : "Check back later as new teams are created by managers."}
            </p>
            {searchQuery && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            )}
            {!searchQuery && (
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link href="/runner/races">
                  <Trophy className="mr-2 h-4 w-4" />Browse Races
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTeams.map((team) => {
            const pending = isPending(team.id)
            const memberCount = team.memberDetails?.length || 0
            const fillPercent = Math.min((memberCount / MAX_TEAM_SIZE) * 100, 100)
            const isExpanded = expandedTeam === team.id
            const isFull = memberCount >= MAX_TEAM_SIZE

            return (
              <div
                key={team.id}
                className={`rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-200 ${
                  isExpanded ? "border-primary/30 shadow-md" : "hover:border-border/80 hover:shadow-md"
                }`}
              >
                {/* Card Header — always visible */}
                <button
                  className="w-full text-left px-4 py-4 flex items-center gap-3"
                  onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                >
                  {/* Team logo/initials */}
                  <div className="h-11 w-11 rounded-xl overflow-hidden border border-border shrink-0 flex items-center justify-center bg-red-50">
                    {team.logo_url ? (
                      <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-red-600">
                        {team.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground">{team.name}</span>
                      {team.is_high_school && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <School className="h-3.5 w-3.5 text-accent" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>High School Team</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {pending && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs h-5">
                          <Clock className="h-2.5 w-2.5 mr-1" />Pending
                        </Badge>
                      )}
                    
                    </div>

                    {/* Member avatars + count */}
                    <div className="flex items-center gap-2 mt-1">
                      {memberCount > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-1.5">
                            {(team.memberDetails || []).slice(0, 4).map((m) => (
                              <Avatar key={m.id} className="h-5 w-5 border border-background">
                                <AvatarFallback className="text-[8px] bg-muted text-muted-foreground">
                                  {getInitials(m.first_name, m.last_name)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {memberCount > 4 && (
                              <div className="h-5 w-5 rounded-full border border-background bg-muted flex items-center justify-center">
                                <span className="text-[8px] text-muted-foreground font-medium">+{memberCount - 4}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{memberCount} members</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">0/{MAX_TEAM_SIZE} members</span>
                      )}
                    </div>

                    {/* Team size progress bar */}
                    <div className="mt-1.5 w-32">
                      <Progress
                        value={fillPercent}
                        className={`h-1 ${
                          fillPercent >= 100 ? "[&>div]:bg-red-500" :
                          fillPercent >= 70 ? "[&>div]:bg-amber-500" :
                          "[&>div]:bg-green-500"
                        }`}
                      />
                    </div>
                  </div>

                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">

                    {/* Team description */}
                    {team.details && (
                      <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                        {team.details}
                      </p>
                    )}

                    {/* Manager card */}
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Manager</h4>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-amber-500 text-white text-xs font-semibold">
                            {getInitials(team.manager?.first_name || null, team.manager?.last_name || null)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {[team.manager?.first_name, team.manager?.last_name].filter(Boolean).join(" ") || "Team Manager"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{team.manager?.email}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                            <Crown className="h-2.5 w-2.5 mr-1" />Manager
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Members */}
                    {memberCount > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Members ({memberCount}/{MAX_TEAM_SIZE})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(team.memberDetails || []).slice(0, 6).map((member) => (
                            <div key={member.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border text-xs">
                              <Avatar className="h-4 w-4">
                                <AvatarFallback className="text-[8px] bg-muted-foreground/20">
                                  {getInitials(member.first_name, member.last_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">
                                {member.first_name || ""}{" "}
                                {member.last_name?.charAt(0) || ""}{member.last_name ? "." : ""}
                              </span>
                              {member.gender && (
                                <span className="text-muted-foreground capitalize">{member.gender[0]}</span>
                              )}
                            </div>
                          ))}
                          {memberCount > 6 && (
                            <div className="px-2.5 py-1 rounded-full bg-muted/60 border text-xs text-muted-foreground">
                              +{memberCount - 6} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Join button */}
                    <div className="pt-2 border-t border-border/50">
                      {isAlreadyInTeam && (
                        <p className="text-xs text-amber-600 mb-2">
                          <Link href="/runner/teams" className="underline">Leave your current team</Link> first.
                        </p>
                      )}
                      {isFull && !isAlreadyInTeam && (
                        <p className="text-xs text-muted-foreground mb-2">This team is currently full.</p>
                      )}
                      <Button
                        size="sm"
                        onClick={() => openJoinDialog(team)}
                        disabled={pending || requestingTeam === team.id || isAlreadyInTeam || isFull}
                        className={`${
                          pending
                            ? "bg-green-600 hover:bg-green-600 cursor-default"
                            : "bg-[#FF0000] hover:bg-red-700 cursor-pointer"
                        }`}
                      >
                        {requestingTeam === team.id ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Sending...</>
                        ) : pending ? (
                          <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Request Sent</>
                        ) : (
                          <><Send className="h-3.5 w-3.5 mr-1.5" />Request to Join</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Join dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request to Join</DialogTitle>
            <DialogDescription>
              Send a join request to <strong>{selectedTeam?.name}</strong>. The manager will review it.
            </DialogDescription>
          </DialogHeader>

          {selectedTeam && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
              <div className="h-9 w-9 rounded-lg bg-red-50 border flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-red-600">
                  {selectedTeam.name.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-sm">{selectedTeam.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedTeam.memberDetails?.length || 0}/{MAX_TEAM_SIZE} members
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">
              Message <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <Textarea
              id="message"
              placeholder="Introduce yourself or explain why you'd like to join..."
              value={joinMessage}
              onChange={(e) => setJoinMessage(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinDialogOpen(false)} disabled={!!requestingTeam} className="bg-transparent cursor-pointer">
              Cancel
            </Button>
            <Button onClick={handleRequestToJoin} disabled={!!requestingTeam} className="bg-[#FF0000] hover:bg-red-700 cursor-pointer">
              {requestingTeam
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</>
                : <><Send className="h-4 w-4 mr-2" />Send Request</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
