"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Download,
  Eye,
  Users,
  Trophy,
  CreditCard,
  FileText,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

type SubTeamType = "male" | "female" | "co-ed";

type Registration = {
  id: string;
  race_id: string;
  team_id: string;
  sub_team_type: SubTeamType;
  sub_team_types?: SubTeamType[];
  runners: string[];
  runners_by_subteam?: Record<SubTeamType, string[]>;
  payment_status: "pending" | "paid" | "failed";
  paid_amount: number;
  created_at: string;
  race: {
    id: string;
    title: string;
    date: string;
    venue: string;
    status: "past" | "current" | "upcoming";
  };
  team: {
    id: string;
    name: string;
    manager_id: string;
    manager: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
    };
  };
};

type RunnerInfo = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type RaceWithRegistrations = {
  id: string;
  title: string;
  date: string;
  venue: string;
  status: "past" | "current" | "upcoming";
  registrations: Registration[];
};

export default function AdminRegistrationsPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [runnersMap, setRunnersMap] = useState<Record<string, RunnerInfo>>({});
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [raceFilter, setRaceFilter] = useState<string>("all");
  const [selectedRegistration, setSelectedRegistration] =
    useState<Registration | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const { toast } = useToast();

  // Keep in sync when header pushes a new ?q= param
  useEffect(() => {
    setSearch(searchParams.get("q") ?? "")
  }, [searchParams])

  const loadData = useCallback(async () => {
    const supabase = createClient();

    // Fetch registrations with race and team details
    const { data: regData, error: regError } = await supabase
      .from("registrations")
      .select(
        `
        *,
        race:races(*),
        team:teams(
          *,
          manager:users!teams_manager_id_fkey(id, first_name, last_name, email)
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (regError) {
      toast({
        title: "Error",
        description: "Failed to load registrations",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setRegistrations((regData || []) as Registration[]);

    // Collect all runner IDs
    const allRunnerIds = new Set<string>();
    regData?.forEach((reg) => {
      reg.runners?.forEach((id: string) => allRunnerIds.add(id));
    });

    // Fetch runner details
    if (allRunnerIds.size > 0) {
      const { data: runnerData } = await supabase
        .from("users")
        .select("id, first_name, last_name, email")
        .in("id", Array.from(allRunnerIds));

      const map: Record<string, RunnerInfo> = {};
      runnerData?.forEach((runner) => {
        map[runner.id] = runner;
      });
      setRunnersMap(map);
    }

    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group registrations by race
  const raceGroups: RaceWithRegistrations[] = registrations.reduce(
    (acc, reg) => {
      const existingRace = acc.find((r) => r.id === reg.race_id);
      if (existingRace) {
        existingRace.registrations.push(reg);
      } else {
        acc.push({
          id: reg.race.id,
          title: reg.race.title,
          date: reg.race.date,
          venue: reg.race.venue,
          status: reg.race.status,
          registrations: [reg],
        });
      }
      return acc;
    },
    [] as RaceWithRegistrations[],
  );

  // Sort races by date (upcoming first)
  raceGroups.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (a.status === "upcoming" && b.status !== "upcoming") return -1;
    if (a.status !== "upcoming" && b.status === "upcoming") return 1;
    return dateA - dateB;
  });

  // Get unique races for filter
  const uniqueRaces = Array.from(
    new Set(registrations.map((r) => r.race_id)),
  ).map((id) => {
    const reg = registrations.find((r) => r.race_id === id);
    return { id, title: reg?.race.title || "" };
  });

  // Filter registrations
  const filteredRaceGroups = raceGroups
    .map((group) => ({
      ...group,
      registrations: group.registrations.filter((reg) => {
        const matchesSearch =
          search === "" ||
          reg.team.name.toLowerCase().includes(search.toLowerCase()) ||
          reg.team.manager.email.toLowerCase().includes(search.toLowerCase());
        const matchesStatus =
          statusFilter === "all" || reg.payment_status === statusFilter;
        const matchesRace = raceFilter === "all" || reg.race_id === raceFilter;
        return matchesSearch && matchesStatus && matchesRace;
      }),
    }))
    .filter((group) => group.registrations.length > 0);

  // Stats
  const totalRegistrations = registrations.length;
  const paidRegistrations = registrations.filter(
    (r) => r.payment_status === "paid",
  ).length;
  const pendingRegistrations = registrations.filter(
    (r) => r.payment_status === "pending",
  ).length;
  const totalRevenue = registrations
    .filter((r) => r.payment_status === "paid")
    .reduce((sum, r) => sum + (r.paid_amount || 0), 0);

  // Sub-team helpers
  function getSubTeamTypes(reg: Registration): SubTeamType[] {
    return reg.sub_team_types && reg.sub_team_types.length > 0
      ? reg.sub_team_types
      : [reg.sub_team_type];
  }

  function getSubTeamBadgeColor(type: string) {
    const colors: Record<string, string> = {
      male: "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700",
      female:
        "bg-pink-50 text-pink-700 border-pink-300 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-700",
      "co-ed": "bg-gray-400 text-white border-accent/50",
    };
    return colors[type] || "";
  }

  function getSubTeamBadges(reg: Registration) {
    const types = getSubTeamTypes(reg);
    return (
      <div className="flex flex-wrap gap-1">
        {types.map((type) => (
          <Badge
            key={type}
            variant="outline"
            className={`capitalize ${getSubTeamBadgeColor(type)}`}
          >
            {type}
          </Badge>
        ))}
      </div>
    );
  }

  function getRunnersForSubTeam(
    reg: Registration,
    subTeamType: SubTeamType,
  ): string[] {
    if (reg.runners_by_subteam && reg.runners_by_subteam[subTeamType]) {
      return reg.runners_by_subteam[subTeamType];
    }
    // Fallback: if only one sub-team, return all runners
    const types = getSubTeamTypes(reg);
    if (types.length === 1 && types[0] === subTeamType) {
      return reg.runners || [];
    }
    return [];
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getRaceStatusBadge(status: string) {
    switch (status) {
      case "upcoming":
        return <Badge>Upcoming</Badge>;
      case "current":
        return <Badge variant="secondary">Current</Badge>;
      case "past":
        return <Badge variant="outline">Past</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function exportToCSV() {
    const headers = [
      "Race",
      "Race Date",
      "Team",
      "Sub-Teams",
      "Manager",
      "Manager Email",
      "Total Runners",
      "Payment Status",
      "Amount Paid",
      "Registration Date",
    ];

    const rows = registrations.map((reg) => {
      const subTeams = getSubTeamTypes(reg).join(", ");
      return [
        reg.race.title,
        new Date(reg.race.date).toLocaleDateString(),
        reg.team.name,
        subTeams,
        `${reg.team.manager.first_name} ${reg.team.manager.last_name}`,
        reg.team.manager.email,
        reg.runners.length,
        reg.payment_status,
        reg.paid_amount || 0,
        new Date(reg.created_at).toLocaleDateString(),
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `registrations_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast({
      title: "Export Complete",
      description: `Exported ${registrations.length} registrations to CSV`,
    });
  }

  function openDetailDialog(reg: Registration) {
    setSelectedRegistration(reg);
    setDetailDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            All Registrations
          </h2>
          <p className="text-muted-foreground">
            Manage race registrations across all teams
          </p>
        </div>

        <Button
          className="bg-[#EE0505] hover:bg-red-700 hover:shadow-lg  cursor-pointer"
          onClick={exportToCSV}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Registrations
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRegistrations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidRegistrations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRegistrations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by team or manager..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={raceFilter} onValueChange={setRaceFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by race" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Races</SelectItem>
                {uniqueRaces.map((race) => (
                  <SelectItem key={race.id} value={race.id}>
                    {race.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Payment status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Registrations by Race */}
      {filteredRaceGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              No registrations found matching your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={filteredRaceGroups.map((g) => g.id)}
          className="space-y-4"
        >
          {filteredRaceGroups.map((raceGroup) => (
            <AccordionItem
              key={raceGroup.id}
              value={raceGroup.id}
              className="border rounded-lg bg-card"
            >
              <AccordionTrigger className="px-6 hover:no-underline cursor-pointer">
                <div className="flex flex-1 items-center justify-between pr-4">
                  <div className="flex items-center gap-3">
                    <Trophy className="h-5 w-5 text-red-600" />
                    <div className="text-left">
                      <p className="font-semibold">{raceGroup.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(raceGroup.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        - {raceGroup.venue}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getRaceStatusBadge(raceGroup.status)}
                    <Badge variant="outline">
                      {raceGroup.registrations.length} teams
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          Sub-Team
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          Runners
                        </TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="hidden lg:table-cell">
                          Amount
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {raceGroup.registrations.map((reg) => (
                        <TableRow key={reg.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{reg.team.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {reg.team.manager.first_name}{" "}
                                {reg.team.manager.last_name}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {getSubTeamBadges(reg)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>{reg.runners.length}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(reg.payment_status)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
  {reg.payment_status === "paid"
    ? `$${reg.paid_amount?.toLocaleString() || 0}`
    : <span className="text-muted-foreground">${(reg.runners.length * 10).toLocaleString()} expected</span>
  }
</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="cursor-pointer"
                              onClick={() => openDetailDialog(reg)}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View details</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Registration Details
            </DialogTitle>
            <DialogDescription>
              {selectedRegistration?.team.name} -{" "}
              {selectedRegistration?.race.title}
            </DialogDescription>
          </DialogHeader>
          {selectedRegistration && (
            <div className="space-y-6">
              {/* Race Info */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Race Information
                </h4>
                <div className="rounded-md bg-muted p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Race</span>
                    <span className="text-sm font-medium">
                      {selectedRegistration.race.title}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Date</span>
                    <span className="text-sm">
                      {new Date(
                        selectedRegistration.race.date,
                      ).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Venue</span>
                    <span className="text-sm">
                      {selectedRegistration.race.venue}
                    </span>
                  </div>
                </div>
              </div>

              {/* Team Info */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team Information
                </h4>
                <div className="rounded-md bg-muted p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Team</span>
                    <span className="text-sm font-medium">
                      {selectedRegistration.team.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Sub-Teams
                    </span>
                    {getSubTeamBadges(selectedRegistration)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Manager
                    </span>
                    <span className="text-sm">
                      {selectedRegistration.team.manager.first_name}{" "}
                      {selectedRegistration.team.manager.last_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="text-sm">
                      {selectedRegistration.team.manager.email}
                    </span>
                  </div>
                </div>
              </div>

              {/* Runners by Sub-Team */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">
                  Runners ({selectedRegistration.runners.length})
                </h4>

                <Accordion
                  type="multiple"
                  defaultValue={getSubTeamTypes(selectedRegistration)}
                  className="space-y-2"
                >
                  {getSubTeamTypes(selectedRegistration).map((subTeamType) => {
                    const subTeamRunners = getRunnersForSubTeam(
                      selectedRegistration,
                      subTeamType,
                    );
                    return (
                      <AccordionItem
                        key={subTeamType}
                        value={subTeamType}
                        className="border rounded-lg border-accent/30"
                      >
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className={`capitalize ${getSubTeamBadgeColor(subTeamType)}`}
                            >
                              {subTeamType}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {subTeamRunners.length} runners
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-3">
                          <div className="rounded-md border divide-y">
                            {subTeamRunners.length === 0 ? (
                              <div className="p-3 text-center text-sm text-muted-foreground">
                                No runners assigned
                              </div>
                            ) : (
                              subTeamRunners.map((runnerId, index) => {
                                const runner = runnersMap[runnerId];
                                return (
                                  <div
                                    key={runnerId}
                                    className="p-3 flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground w-5">
                                        {index + 1}.
                                      </span>
                                      <div>
                                        <p className="text-sm font-medium">
                                          {runner
                                            ? `${runner.first_name} ${runner.last_name}`
                                            : "Unknown Runner"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {runner?.email || runnerId}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>

              {/* Payment Info */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Information
                </h4>
                <div className="rounded-md bg-muted p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status</span>
                    {getStatusBadge(selectedRegistration.payment_status)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Amount Paid</span>
                    <span className="text-sm font-medium">
  {selectedRegistration.payment_status === "paid"
    ? `$${selectedRegistration.paid_amount?.toLocaleString() || 0}`
    : `$${(selectedRegistration.runners.length * 10).toLocaleString()} expected`}
</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Registered</span>
                    <span className="text-sm">
                      {new Date(selectedRegistration.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
