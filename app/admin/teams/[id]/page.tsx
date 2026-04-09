"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Users,
  School,
  Mail,
  Calendar,
  Shield,
  User,
  Hash,
  Activity,
  Crown,
  Pencil,
} from "lucide-react"

interface Member {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: string
  gender: string | null
  age: number | null
  created_at: string
}

interface Team {
  id: string
  name: string
  manager_id: string
  members: string[]
  details: string | null
  is_high_school: boolean
  created_at: string
  updated_at: string | null
  manager: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

export default function AdminTeamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const teamId = params.id as string

  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [registrationCount, setRegistrationCount] = useState(0)

  useEffect(() => {
    fetchTeamData()
  }, [teamId])

  const fetchTeamData = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select(`*, manager:users!teams_manager_id_fkey(id, first_name, last_name, email)`)
      .eq("id", teamId)
      .single()

    if (teamError || !teamData) {
      toast({ title: "Error", description: "Team not found", variant: "destructive" })
      router.push("/admin/teams")
      return
    }

    setTeam(teamData)

    if (teamData.members?.length > 0) {
      const { data: memberData } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, role, gender, age, created_at")
        .in("id", teamData.members)

      setMembers(memberData || [])
    }

    const { count } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)

    setRegistrationCount(count || 0)
    setLoading(false)
  }

  const getInitials = (firstName: string | null, lastName: string | null) =>
    `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?"

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

  const getRoleBadge = (role: string, isManager: boolean) => {
    if (isManager) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Manager</Badge>
    if (role === "assistant_manager") return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Asst. Manager</Badge>
    return <Badge variant="secondary">Runner</Badge>
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!team) return null

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/teams")}
            className="mt-0.5 shrink-0 cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold">{team.name}</h1>
              {team.is_high_school && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1">
                  <School className="h-3 w-3" /> High School
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Created {formatDate(team.created_at)}
              {team.updated_at && ` · Updated ${formatDate(team.updated_at)}`}
            </p>
          </div>
        </div>
        <Button
          className="bg-[#EE0505] hover:bg-red-700 cursor-pointer self-start sm:self-auto"
          onClick={() => router.push(`/admin/teams?edit=${teamId}`)}
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit Team
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: Users, label: "Total Members", value: team.members?.length || 0, color: "bg-blue-500/10 text-blue-600" },
          { icon: Activity, label: "Registrations", value: registrationCount, color: "bg-green-500/10 text-green-600" },
          { icon: Crown, label: "Manager", value: team.manager ? `${team.manager.first_name ?? ""} ${team.manager.last_name ?? ""}`.trim() || "—" : "—", color: "bg-amber-500/10 text-amber-600" },
          { icon: Hash, label: "Team ID", value: team.id.slice(0, 8) + "…", color: "bg-slate-500/10 text-slate-600" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`rounded-full p-2.5 shrink-0 ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold text-sm truncate">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Manager + Description info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-600" /> Manager Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            {team.manager ? (
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-amber-100 text-amber-800 font-semibold">
                    {getInitials(team.manager.first_name, team.manager.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">
                    {team.manager.first_name} {team.manager.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{team.manager.email}</span>
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No manager assigned</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" /> Team Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {team.details ? (
              <p className="text-muted-foreground">{team.details}</p>
            ) : (
              <p className="text-muted-foreground italic">No description provided</p>
            )}
            <div className="flex flex-wrap gap-4 pt-1">
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-medium">{formatDate(team.created_at)}</p>
              </div>
              {team.updated_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{formatDate(team.updated_at)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Team Members
            <Badge variant="secondary" className="ml-1">{members.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">No members in this team yet</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => {
                      const isManager = member.id === team.manager_id
                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className={`text-xs font-semibold ${isManager ? "bg-amber-100 text-amber-800" : "bg-primary/10 text-primary"}`}>
                                  {getInitials(member.first_name, member.last_name)}
                                </AvatarFallback>
                              </Avatar>
                              <p className="font-medium text-sm">
                                {member.first_name} {member.last_name}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {member.email}
                          </TableCell>
                          <TableCell>
                            {getRoleBadge(member.role, isManager)}
                          </TableCell>
                          <TableCell className="text-sm capitalize text-muted-foreground">
                            {member.gender || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {member.age ? `${member.age} yrs` : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(member.created_at)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {members.map((member) => {
                  const isManager = member.id === team.manager_id
                  return (
                    <div key={member.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className={`text-sm font-semibold ${isManager ? "bg-amber-100 text-amber-800" : "bg-primary/10 text-primary"}`}>
                          {getInitials(member.first_name, member.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm truncate">
                            {member.first_name} {member.last_name}
                          </p>
                          {getRoleBadge(member.role, isManager)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{member.email}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                          {member.gender && <span className="capitalize flex items-center gap-1"><User className="h-3 w-3" />{member.gender}</span>}
                          {member.age && <span>{member.age} yrs</span>}
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Joined {formatDate(member.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}