"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import {
  User,
  Phone,
  Calendar,
  Trophy,
  Users,
  UserPlus,
  Clock,
  CreditCard,
  Mail,
  Plus,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import type {
  ManagerInfo,
  Team,
  Registration,
  RunnerStats,
  Race,
} from "./page";
import Image from "next/image";
import { TeamLogo } from "@/components/team-logo";

type ManagerDashboardProps = {
  manager: ManagerInfo | null;
  role: "manager" | "assistant_manager";
  teams: Team[];
  registrations: Registration[];
  runnerStats: RunnerStats;
  pendingInvitations: {
    id: string
    type: string
    status: string
    created_at: string
    to_user?: { id: string; first_name: string | null; last_name: string | null; email: string } | null
    team?: { id: string; name: string } | null
  }[];
  upcomingRaces: Race[];
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatAddress(address: ManagerInfo["address"]) {
  if (!address) return "Not provided";
  const parts = [
    address.street,
    address.city,
    address.state,
    address.zipCode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Not provided";
}

function getStatusColor(status: string) {
  switch (status) {
    case "upcoming":
      return "bg-primary text-primary-foreground";
    case "current":
      return "bg-secondary text-secondary-foreground";
    case "past":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getPaymentStatusColor(status: string) {
  switch (status) {
    case "paid":
      return "bg-secondary text-secondary-foreground";
    case "pending":
      return "bg-warning text-warning-foreground";
    case "failed":
      return "bg-destructive text-destructive-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getInitials(firstName: string | null, lastName: string | null) {
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase() || "?";
}

const genderChartConfig: ChartConfig = {
  male: {
    label: "Male",
    color: "red",
  },
  female: {
    label: "Female",
    color: "hsl(var(--secondary))",
  },
  other: {
    label: "Other",
    color: "hsl(var(--warning))",
  },
};

const ageChartConfig: ChartConfig = {
  count: {
    label: "Runners",
    color: "hsl(var(--primary))",
  },
};

export function ManagerDashboardClient({
  manager,
  role,
  teams,
  registrations,
  runnerStats,
  pendingInvitations,
  upcomingRaces,
}: ManagerDashboardProps) {
  const managerName = manager?.first_name
    ? `${manager.first_name}${manager.last_name ? ` ${manager.last_name}` : ""}`
    : "Manager";

  const genderData = [
    { name: "Male", value: runnerStats.maleCount, fill: "red" },
    {
      name: "Female",
      value: runnerStats.femaleCount,
      fill: "gray",
    },
    {
      name: "Other",
      value: runnerStats.otherCount,
      fill: "#DBDCE2",
    },
  ].filter((d) => d.value > 0);

  const ageData = runnerStats.ageRanges.filter((d) => d.count > 0);

  const totalSpent = registrations
    .filter((r) => r.payment_status === "paid")
    .reduce((sum, r) => sum + (r.paid_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h2 className="text-2xl font-bold capitalize tracking-tight text-foreground">
          Welcome back, {managerName}!
        </h2>
        <p className="text-muted-foreground">
          {role === "assistant_manager"
            ? "View your team and race registrations."
            : "Manage your teams and race registrations."}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registrations</CardTitle>
            <Users className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">  {
                registrations.filter((r) => r.race?.status === "upcoming")
                  .length
              }</div>
            <p className="text-xs text-muted-foreground">
            
              active registrations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <UserPlus className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runnerStats.totalRunners}</div>
            <p className="text-xs text-muted-foreground">Across all teams</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Race Entries</CardTitle>
            <Trophy className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{registrations.length}</div>
            <p className="text-xs text-muted-foreground">
              {
                registrations.filter((r) => r.race?.status === "upcoming")
                  .length
              }{" "}
              upcoming,{" "}
              {registrations.filter((r) => r.race?.status === "past").length}{" "}
              completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <CreditCard className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Registration fees</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Basic Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-red-500" />
              {role === "assistant_manager" ? "Profile Information" : "Manager Information"}
            </CardTitle>
            <CardDescription>Your personal profile details</CardDescription>
          </CardHeader>
          <CardContent>
            {manager ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-gray-600 capitalize text-primary-foreground text-xl">
                      {getInitials(manager.first_name, manager.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-lg text-foreground">
                      {manager.first_name || ""} {manager.last_name || ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {manager.email}
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      {role === "assistant_manager" ? "Assistant Manager" : "Team Manager"}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-3 pt-2">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Age</span>
                    <span className="text-sm font-medium text-foreground">
                      {manager.age || "Not provided"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">
                      Gender
                    </span>
                    <span className="text-sm font-medium text-foreground capitalize">
                      {manager.gender || "Not provided"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between py-2">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                       Phone
                    </span>
                    <span className="text-sm font-medium text-foreground text-right max-w-[60%]">
                      {manager.phone || "Not provided"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading profile...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Info Card */}

        <Card className="relative overflow-hidden rounded-xl text-white border-0">
          {/* Background Image */}
          <Image
            src="/red card.png"
            alt="background"
            fill
            priority
            className="object-cover"
          />

          {/* Dark Gradient Overlay */}
          <div className="absolute inset-0 " />

          {/* Content Wrapper */}
          <div className="relative z-10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="h-5 w-5 " />
                {role === "assistant_manager" ? "Your Team" : "Your Teams"}
              </CardTitle>
              <CardDescription className="text-white/70 mb-3">
                {role === "assistant_manager" ? "Team you are part of" : "Teams you manage"}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {teams.length > 0 ? (
                <div className="space-y-3">
                  {teams.slice(0, 4).map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-300"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl overflow-hidden border border-white/30 bg-white/20 flex items-center justify-center">
                          {team.logo_url ? (
                            <Image src={team.logo_url} alt={team.name} width={40} height={40} className="object-cover w-full h-full" unoptimized />
                          ) : (
                            <span className="text-sm font-medium text-white">
                              {team.name.substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="font-medium text-white flex items-center gap-1.5">
                            {team.is_high_school && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <GraduationCap className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    High School Team
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {team.name}
                          </p>

                          <p className="text-xs text-white/60">
                            {team.memberDetails?.length || 0} members
                          </p>
                        </div>
                      </div>

                      <Badge className="bg-white/20 text-white border border-white/30">
                        <Users className="h-3 w-3 mr-1" />
                        {team.memberDetails?.length || 0}
                      </Badge>
                    </div>
                  ))}

                  {teams.length > 4 && (
                    <p className="text-sm text-center text-white/60">
                      +{teams.length - 4} more teams
                    </p>
                  )}

                  <Button
                    variant="outline"
                    className="w-full mt-2 bg-white/10 text-white hover:text-white/70 border-white/30 hover:bg-white/20 backdrop-blur-md"
                    asChild
                  >
                    <Link href="/manager/teams">View Team Members</Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-white/40 mb-3" />
                  <p className="text-white/70">
                    You have not created any teams yet
                  </p>

                  <Button
                    className="mt-4 bg-red-600 hover:bg-red-700 hover:shadow-lg transition-all duration-300"
                    asChild
                  >
                    <Link href="/manager/teams">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Team
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      </div>

      {/* Registered Runners Stats */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Gender Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-red-500" />
              Runner Gender Distribution
            </CardTitle>
            <CardDescription>
              {runnerStats.maleCount} Male, {runnerStats.femaleCount} Female,{" "}
              {runnerStats.otherCount} Other
            </CardDescription>
          </CardHeader>
          <CardContent>
            {genderData.length > 0 ? (
              <ChartContainer
                config={genderChartConfig}
                className="h-[250px] w-full"
              >
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {genderData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center">
                <p className="text-muted-foreground">
                  No runner data available
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Age Distribution Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-red-500" />
              Runner Age Distribution
            </CardTitle>
            <CardDescription>Age ranges of your team members</CardDescription>
          </CardHeader>
          <CardContent>
            {ageData.length > 0 ? (
              <ChartContainer
                config={ageChartConfig}
                className="h-[250px] w-full"
              >
                <BarChart data={ageData}>
                  <XAxis
                    dataKey="range"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="red"
                    radius={[4, 4, 0, 0]}
                    name="Runners"
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center">
                <p className="text-muted-foreground">
                  No runner data available
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Registered Races Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-red-500" />
            Current Registered Races
          </CardTitle>
          <CardDescription>Your teams' race registrations</CardDescription>
        </CardHeader>
        <CardContent>
          {registrations.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Race</TableHead>
                    <TableHead className="hidden sm:table-cell">Team</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Payment
                    </TableHead>
                    <TableHead className="text-right hidden md:table-cell">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.slice(0, 10).map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {reg.race?.title}
                          </p>
                          <p className="text-xs text-muted-foreground sm:hidden">
                            {reg.team?.name} -{" "}
                            {reg.race?.date ? formatDate(reg.race.date) : "TBD"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{reg.team?.name}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {reg.race?.date ? formatDate(reg.race.date) : "TBD"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getStatusColor(
                            reg.race?.status || "upcoming",
                          )}
                        >
                          {reg.race?.status || "upcoming"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          variant="outline"
                          className={getPaymentStatusColor(reg.payment_status)}
                        >
                          <CreditCard className="h-3 w-3 mr-1" />
                          {reg.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell font-medium">
                        ${reg.paid_amount?.toFixed(2) || "0.00"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No race registrations yet</p>
              <Button
                className="mt-4 bg-[#FF0000] hover:shadow-lg hover:bg-red-600"
                asChild
              >
                <Link href="/manager/races">Browse Races</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Actions */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-red-500" />
              Pending Invitations
            </CardTitle>
            <CardDescription>Invitations awaiting response</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingInvitations.length > 0 ? (
              <div className="space-y-3">
                {pendingInvitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-gray-500 text-white text-xs">
                          {getInitials(inv.to_user?.first_name ?? null, inv.to_user?.last_name ?? null)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {inv.to_user?.first_name} {inv.to_user?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {inv.team?.name} · {inv.type === "am_assignment" ? "AM Invite" : "Team Invite"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50 shrink-0 ml-2">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  </div>
                ))}
                <Button variant="outline" className="w-full bg-transparent" asChild>
                  <Link href="/manager/invitations">View All Invitations</Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-1" />
                <p className="text-muted-foreground text-sm">
                  No pending invitations yet
                </p>{" "}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Races */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-red-500" />
              Upcoming Races
            </CardTitle>
            <CardDescription>
              Register your teams for these races
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingRaces.length > 0 ? (
              <div className="space-y-3">
                {upcomingRaces.slice(0, 3).map((race) => (
                  <div
                    key={race.id}
                    className="flex items-center justify-between p-2 rounded border border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">
                        {race.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(race.date)} - {race.venue}
                      </p>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  asChild
                >
                  <Link href="/manager/races">View All Races</Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  No upcoming races
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
