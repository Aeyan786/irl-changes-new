"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  MapPin,
  Calendar,
  Trophy,
  Users,
  TrendingUp,
  Clock,
  CreditCard,
  Mail,
  CheckCircle2,
  UserPlus,
  School,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { UserInfo, Race, Registration, Team, TeamMember } from "./page";
import Image from "next/image";
import Link from "next/link";
import { TeamLogo } from "@/components/team-logo";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type RunnerDashboardProps = {
  user: UserInfo | null;
  team: Team | null;
  registrations: Registration[];
  upcomingRaces: Race[];
  pendingInvitations: { id: string; type: string; team_id: string | null }[];
};

// ── CT timezone date helpers ──────────────────────────────────────────────
function formatRaceDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRaceTime(dateString: string): string {
  if (!dateString.includes("T")) return "";
  const date = new Date(dateString);
  const time = date.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  if (time === "12:00 AM") return "";
  const tzAbbr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).formatToParts(date).find((p) => p.type === "timeZoneName")?.value;
  return `${time} ${tzAbbr || "CT"}`;
}

function formatAddress(address: UserInfo["address"]) {
  if (!address) return null;
  const parts = [address.street, address.city, address.state, address.zipCode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function getStatusColor(status: string) {
  switch (status) {
    case "upcoming": return "border-blue-500 text-blue-600";
    case "current":  return "border-green-500 text-green-600";
    case "past":     return "border-gray-400 text-gray-500";
    default:         return "border-blue-500 text-blue-600";
  }
}

function getPaymentStatusColor(status: string) {
  switch (status) {
    case "paid":    return "bg-green-100 text-green-700 border-green-200";
    case "pending": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "failed":  return "bg-red-100 text-red-700 border-red-200";
    default:        return "bg-muted text-muted-foreground";
  }
}

function getInitials(firstName: string | null, lastName: string | null) {
  return (`${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`).toUpperCase() || "?";
}

export function RunnerDashboardClient({
  user,
  team,
  registrations,
  upcomingRaces,
  pendingInvitations,
}: RunnerDashboardProps) {
  const router = useRouter()

  // Silently refresh when teams or registrations change
  useEffect(() => {
    const { createClient } = require("@/lib/supabase/client")
    const supabase = createClient()
    const channel = supabase
      .channel("runner-dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => {
        router.refresh()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations" }, () => {
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const userName = user?.first_name
    ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ""}`
    : "Runner";

  const isInTeam = !!user?.current_team_id;
  const hasIncompleteProfile = !user?.age || !user?.gender || !formatAddress(user?.address);

  return (
    <div className="space-y-6">

      {/* Welcome Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight capitalize text-foreground">
          Welcome Back, {userName}!
        </h2>
        <p className="text-muted-foreground">
          Here is an overview of your running activities.
        </p>
      </div>

      {/* Incomplete Profile Prompt */}
      {hasIncompleteProfile && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-yellow-100 p-1.5">
              <User className="h-4 w-4 text-yellow-600" />
            </div>
            <p className="text-sm text-yellow-800">
              <strong>Complete your profile</strong> — Add your age, gender and address to help your team manager.
            </p>
          </div>
          <Button size="sm" variant="outline" className="border-yellow-300 text-yellow-700 hover:bg-yellow-100 shrink-0" asChild>
            <Link href="/runner/settings">Update <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Upcoming Races</p>
              <div className="rounded-full bg-blue-100 p-2">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold">
              {registrations.filter((r) => r.race?.status === "upcoming" || r.race?.status === "current").length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Registered races</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Completed Races</p>
              <div className="rounded-full bg-purple-100 p-2">
                <Trophy className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold">
              {registrations.filter((r) => r.race?.status === "past").length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Races finished</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Team Status</p>
              <div className={`rounded-full p-2 ${isInTeam ? "bg-green-100" : "bg-gray-100"}`}>
                <Users className={`h-4 w-4 ${isInTeam ? "text-green-600" : "text-gray-500"}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${isInTeam ? "text-green-600" : "text-gray-500"}`}>
              {isInTeam ? "In Team" : "Available"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {team ? team.name : "Not in any team"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Invitations</p>
              <div className={`rounded-full p-2 ${pendingInvitations.length > 0 ? "bg-red-100" : "bg-gray-100"}`}>
                <Mail className={`h-4 w-4 ${pendingInvitations.length > 0 ? "text-red-600" : "text-gray-500"}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${pendingInvitations.length > 0 ? "text-red-600" : ""}`}>
              {pendingInvitations.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingInvitations.length > 0 ? (
                <Link href="/runner/invitations" className="text-red-600 underline underline-offset-2">
                  View invitations
                </Link>
              ) : "Pending invitations"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

        {/* Basic Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-[#E21A1A]" />
              Basic Information
            </CardTitle>
            <CardDescription>Your personal profile details</CardDescription>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-gray-500 capitalize text-primary-foreground text-xl">
                      {getInitials(user.first_name, user.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-lg text-foreground">
                      {user.first_name || ""} {user.last_name || ""}
                    </p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="grid gap-0 pt-2">
                  {user.age && (
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">Age</span>
                      <span className="text-sm font-medium text-foreground">{user.age}</span>
                    </div>
                  )}
                  {user.gender && (
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">Gender</span>
                      <span className="text-sm font-medium text-foreground capitalize">{user.gender}</span>
                    </div>
                  )}
                  {formatAddress(user.address) && (
                    <div className="flex items-start justify-between py-2">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                         Address
                      </span>
                      <span className="text-sm font-medium text-foreground text-right max-w-[60%]">
                        {formatAddress(user.address)}
                      </span>
                    </div>
                  )}
                  {!user.age && !user.gender && !formatAddress(user.address) && (
                    <div className="py-4 text-center">
                      <p className="text-sm text-muted-foreground">No profile details added yet.</p>
                      <Button size="sm" variant="outline" className="mt-2" asChild>
                        <Link href="/runner/settings">Complete Profile <ArrowRight className="ml-1 h-3 w-3" /></Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-16 w-16 rounded-full bg-muted animate-pulse" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Info Card */}
        <Card className="relative overflow-hidden rounded-xl text-white">
          <Image src="/red card.png" alt="background" fill priority className="object-cover" />
          <div className="absolute inset-0" />
          <div className="relative z-10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 mb-1">
                    <Users className="h-5 w-5 text-white" />
                    Team Information
                  </CardTitle>
                  <CardDescription className="text-white/70">
                    Your current team and teammates
                  </CardDescription>
                </div>
                {isInTeam ? (
                  <Badge className="bg-white/20 text-white border border-white/30 backdrop-blur-sm">
                    <CheckCircle2 className="h-3 w-3 mr-1" />In Team
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-green-400 text-green-300 backdrop-blur-sm">
                    <UserPlus className="h-3 w-3 mr-1" />Available
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {team ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {(team as any).logo_url && (
                      <div className="h-12 w-12 rounded-xl overflow-hidden border-2 border-white/30 shrink-0">
                        <Image
                          src={(team as any).logo_url}
                          alt={team.name}
                          width={48}
                          height={48}
                          className="object-cover w-full h-full"
                          unoptimized
                        />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-white text-lg flex items-center gap-1.5">
                        {team.is_high_school && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <School className="h-4 w-4 text-yellow-300 flex-shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>High School Team</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {team.name}
                      </p>
                      <p className="text-sm text-white/70 mt-1">
                        {team.memberDetails?.length || 0} team {team.memberDetails?.length === 1 ? "member" : "members"}
                      </p>
                    </div>
                  </div>
                  {team.manager && (
                    <div className="pt-2 border-t border-white/20">
                      <p className="text-xs text-white/60 uppercase tracking-wide mb-2">Manager</p>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-white/20 text-white text-xs">
                            {getInitials(team.manager.first_name, team.manager.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {team.manager.first_name} {team.manager.last_name}
                          </p>
                          <p className="text-xs text-white/60">{team.manager.email}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {team.memberDetails && team.memberDetails.length > 0 && (
                    <div className="pt-2 border-t border-white/20">
                      <p className="text-xs text-white/60 uppercase tracking-wide mb-2">
                        Team Members ({team.memberDetails.length})
                      </p>
                      <div className="space-y-2">
                        {team.memberDetails.slice(0, 3).map((member) => (
                          <div key={member.id} className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-white/20 text-white text-xs">
                                {getInitials(member.first_name, member.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-semibold text-white">
                              {member.first_name} {member.last_name}
                            </span>
                          </div>
                        ))}
                        {team.memberDetails.length > 3 && (
                          <Link
                            href="/runner/teams"
                            className="flex items-center justify-between mt-3 pt-3 border-t border-white/20 group"
                          >
                            <span className="text-sm font-semibold text-white group-hover:text-white/80 transition-colors">
                              View all {team.memberDetails.length} members
                            </span>
                            <div className="flex items-center justify-center h-7 px-3 rounded-full bg-white/20 text-white text-xs font-bold group-hover:bg-white/30 transition-colors border border-white/30">
                              +{team.memberDetails.length - 3} more →
                            </div>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-white/40 mb-3" />
                  <p className="text-white/70">You are not part of any team yet</p>
                  <p className="text-sm text-white/60 mt-1">
                    Wait for a manager to invite you or request to join a team.
                  </p>
                  <Badge variant="outline" className="mt-3 border-green-400 text-green-300">
                    <UserPlus className="h-3 w-3 mr-1" />Available for Teams
                  </Badge>
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      </div>

      {/* Registered Races Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#E21A1A]" />
            Current Registered Races
          </CardTitle>
          <CardDescription>Your race registrations and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {registrations.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Race</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="hidden md:table-cell">Venue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Payment</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Amount</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((reg) => {
                    const raceTime = reg.race?.date ? formatRaceTime(reg.race.date) : "";
                    return (
                      <TableRow key={reg.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{reg.race?.title}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              {reg.race?.date ? formatRaceDate(reg.race.date) : "TBD"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col gap-0.5 text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span className="text-xs">{reg.race?.date ? formatRaceDate(reg.race.date) : "TBD"}</span>
                            </div>
                            {raceTime && (
                              <span className="text-xs text-muted-foreground pl-4">{raceTime}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {reg.race?.venue || "TBD"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${getStatusColor(reg.race?.status || "upcoming")} capitalize`}>
                            {reg.race?.status || "upcoming"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell capitalize">
                          <Badge variant="outline" className={getPaymentStatusColor(reg.payment_status)}>
                            <CreditCard className="h-3 w-3 mr-1" />
                            {reg.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right font-medium">
                          {reg.payment_status === "paid" ? (
                            <span className="text-green-600">${reg.paid_amount?.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              ${((reg.runners?.length || 1) * 10).toFixed(2)} expected
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs text-muted-foreground">—</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No race registrations yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your team manager will register you for upcoming races
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Analytics — Compact Coming Soon */}
      <Card>
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Performance Analytics</p>
                <p className="text-sm text-muted-foreground">Track your race times, personal records, and progress</p>
              </div>
            </div>
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 shrink-0">
              <Sparkles className="h-3 w-3 mr-1" />Coming Soon
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming League Races */}
      {upcomingRaces.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-[#E21A1A]" />
                  Upcoming League Races
                </CardTitle>
                <CardDescription>Races available to register for</CardDescription>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/runner/races">View All <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingRaces.map((race) => {
                const raceTime = formatRaceTime(race.date);
                return (
                  <div
                    key={race.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/60 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{race.title}</p>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatRaceDate(race.date)}
                          {raceTime && ` · ${raceTime}`}
                        </span>
                        <span className="hidden sm:flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {race.venue}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <Badge variant="outline" className={`${getStatusColor(race.status)} capitalize`}>
                        {race.status}
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                        <Link href="/runner/races">Details <ArrowRight className="ml-1 h-3 w-3" /></Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
