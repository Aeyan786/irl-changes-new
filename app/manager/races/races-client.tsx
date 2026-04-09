"use client";

import React from "react";
import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  Calendar,
  MapPin,
  Clock,
  Search,
  Users,
  Trophy,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  FileText,
  Shield,
  UserCheck,
  UserX,
  DollarSign,
  AlertTriangle,
  GripVertical,
  ArrowRight,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { registerForRace } from "@/app/actions/races";
import type { Race, Registration, Team, Runner } from "./page";

const RUNNERS_PER_SUBTEAM = 10;
const TOTAL_LEGS = 30;
const MAX_LEGS_PER_RUNNER = 3;

interface ManagerRacesClientProps {
  userId: string;
  currentRaces: Race[];
  upcomingRaces: Race[];
  pastRaces: Race[];
  teams: Team[];
  registrations: Registration[];
  runners: Runner[];
  runnerRaceCount: Record<string, number>;
}

type SubTeamType = "male" | "female" | "co-ed";

// Calculate leg numbers for a runner at a given position (0-indexed)
function getLegsForPosition(
  position: number,
  totalRunners: number = 10,
  totalLegs: number = 30,
): number[] {
  const legsPerRunner = totalLegs / totalRunners;
  const legs: number[] = [];
  for (let round = 0; round < legsPerRunner; round++) {
    legs.push(position + 1 + round * totalRunners);
  }
  return legs;
}

export function ManagerRacesClient({
  userId,
  currentRaces,
  upcomingRaces,
  pastRaces,
  teams,
  registrations,
  runners,
  runnerRaceCount,
}: ManagerRacesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setSearchQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  // Silently refresh when races table changes (e.g. admin creates/edits a race)
  useEffect(() => {
    const { createClient } = require("@/lib/supabase/client");
    const supabase = createClient();
    const channel = supabase
      .channel("manager-races-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "races" },
        () => {
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registrations" },
        () => {
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filterRaces = (raceList: Race[]) => {
    if (!searchQuery.trim()) return raceList;
    const q = searchQuery.toLowerCase();
    return raceList.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.venue.toLowerCase().includes(q) ||
        (r.start_location ?? "").toLowerCase().includes(q) ||
        (r.end_location ?? "").toLowerCase().includes(q) ||
        (r.waypoints ?? []).some((w) => w.toLowerCase().includes(q)),
    );
  };

  const filteredCurrentRaces = useMemo(
    () => filterRaces(currentRaces),
    [currentRaces, searchQuery],
  );
  const filteredUpcomingRaces = useMemo(
    () =>
      filterRaces(upcomingRaces).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [upcomingRaces, searchQuery],
  );
  const filteredPastRaces = useMemo(
    () => filterRaces(pastRaces),
    [pastRaces, searchQuery],
  );

  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const [step, setStep] = useState(1);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedSubTeamTypes, setSelectedSubTeamTypes] = useState<
    SubTeamType[]
  >([]);
  const [runnersBySubTeam, setRunnersBySubTeam] = useState<
    Record<SubTeamType, string[]>
  >({
    male: [],
    female: [],
    "co-ed": [],
  });
  const [orderedRunners, setOrderedRunners] = useState<
    Record<SubTeamType, string[]>
  >({
    male: [],
    female: [],
    "co-ed": [],
  });
  const [activeSubTeam, setActiveSubTeam] = useState<SubTeamType>("male");

  // Drag state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const getRunnerName = (runner: Runner) => {
    if (runner.first_name && runner.last_name)
      return `${runner.first_name} ${runner.last_name}`;
    return runner.email || "Unknown Runner";
  };

  const getRunnerById = (id: string) => runners.find((r) => r.id === id);

  const toggleSubTeamType = (type: SubTeamType) => {
    setSelectedSubTeamTypes((prev) => {
      if (prev.includes(type)) {
        setRunnersBySubTeam((r) => ({ ...r, [type]: [] }));
        setOrderedRunners((r) => ({ ...r, [type]: [] }));
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
    if (!selectedSubTeamTypes.includes(type)) setActiveSubTeam(type);
  };

  const feePerRunner = Number(selectedRace?.registration_fee ?? 10);
  const totalFee =
    selectedSubTeamTypes.length * RUNNERS_PER_SUBTEAM * feePerRunner;
  const requiredRunners = selectedSubTeamTypes.length * RUNNERS_PER_SUBTEAM;
  const totalSelectedRunners = selectedSubTeamTypes.reduce(
    (sum, type) => sum + (runnersBySubTeam[type]?.length || 0),
    0,
  );

  const filteredRunners = useMemo(() => {
    if (!selectedTeamId) return [];
    const team = teams.find((t) => t.id === selectedTeamId);
    if (!team) return [];
    const teamRunners = runners.filter((r) => team.members?.includes(r.id));
    if (activeSubTeam === "male")
      return teamRunners.filter((r) => r.gender === "male");
    if (activeSubTeam === "female")
      return teamRunners.filter((r) => r.gender === "female");
    return teamRunners;
  }, [selectedTeamId, teams, runners, activeSubTeam]);

  const isRunnerSelectedElsewhere = (
    runnerId: string,
    currentSubTeam: SubTeamType,
  ) =>
    Object.entries(runnersBySubTeam).some(
      ([type, arr]) => type !== currentSubTeam && arr.includes(runnerId),
    );

  const hasReachedMaxLegs = (runnerId: string) =>
    (runnerRaceCount[runnerId] || 0) >= MAX_LEGS_PER_RUNNER;

  const toggleRunner = (runnerId: string) => {
    setRunnersBySubTeam((prev) => {
      const current = prev[activeSubTeam] || [];
      if (current.includes(runnerId)) {
        return {
          ...prev,
          [activeSubTeam]: current.filter((id) => id !== runnerId),
        };
      }
      if (current.length >= RUNNERS_PER_SUBTEAM) {
        toast({
          variant: "destructive",
          title: "Sub-team limit reached",
          description: `Max ${RUNNERS_PER_SUBTEAM} runners per sub-team.`,
        });
        return prev;
      }
      return { ...prev, [activeSubTeam]: [...current, runnerId] };
    });
  };

  // When moving from step 2 to step 3, initialize ordered runners from selection order
  const initOrderedRunners = () => {
    const ordered: Record<SubTeamType, string[]> = {
      male: [],
      female: [],
      "co-ed": [],
    };
    for (const type of selectedSubTeamTypes) {
      ordered[type] = [...(runnersBySubTeam[type] || [])];
    }
    setOrderedRunners(ordered);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    dragItem.current = index;
    setDraggingIndex(index);
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
    setDragOverIndex(index);
  };

  const handleDragEnd = (subTeam: SubTeamType) => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current !== dragOverItem.current) {
      setOrderedRunners((prev) => {
        const updated = [...(prev[subTeam] || [])];
        const draggedItem = updated.splice(dragItem.current!, 1)[0];
        updated.splice(dragOverItem.current!, 0, draggedItem);
        return { ...prev, [subTeam]: updated };
      });
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const isRaceRegistered = (raceId: string) =>
    registrations.some((r) => r.race_id === raceId);
  const getRegistration = (raceId: string) =>
    registrations.find((r) => r.race_id === raceId);

  const openRaceDetails = (race: Race) => {
    setSelectedRace(race);
    setShowDetailModal(true);
  };

  const openRegisterModal = (race: Race) => {
    setSelectedRace(race);
    setStep(1);
    setSelectedTeamId(teams.length > 0 ? teams[0].id : "");
    setSelectedSubTeamTypes([]);
    setRunnersBySubTeam({ male: [], female: [], "co-ed": [] });
    setOrderedRunners({ male: [], female: [], "co-ed": [] });
    setActiveSubTeam("male");
    setShowRegisterModal(true);
  };

  const validateSelection = () => {
    const errors: string[] = [];
    if (selectedSubTeamTypes.length === 0) {
      errors.push("Please select at least one sub-team");
      return errors;
    }
    for (const type of selectedSubTeamTypes) {
      const arr = runnersBySubTeam[type] || [];
      if (arr.length !== RUNNERS_PER_SUBTEAM) {
        errors.push(
          `${type.charAt(0).toUpperCase() + type.slice(1)} sub-team needs exactly ${RUNNERS_PER_SUBTEAM} runners (currently ${arr.length})`,
        );
      }
    }
    const all = selectedSubTeamTypes.flatMap((t) => runnersBySubTeam[t] || []);
    if (new Set(all).size !== all.length)
      errors.push("A runner cannot be in multiple sub-teams");
    return errors;
  };

  const handleProceedToPayment = async () => {
    setIsRegistering(true);
    try {
      const result = await registerForRace({
        raceId: selectedRace!.id,
        teamId: selectedTeamId,
        subTeamTypes: selectedSubTeamTypes,
        runners: runnersBySubTeam as Record<
          "male" | "female" | "co-ed",
          string[]
        >,
        orderedRunners: orderedRunners as Record<
          "male" | "female" | "co-ed",
          string[]
        >,
      });
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Registration failed",
          description: result.error,
        });
        setIsRegistering(false);
        return;
      }
      toast({
        title: "Registration successful!",
        description: "Redirecting to payment...",
      });
      setShowRegisterModal(false);
      router.push(
        result.registrationId
          ? `/checkout/${result.registrationId}`
          : "/manager/dashboard",
      );
      router.refresh();
    } catch {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: "An unexpected error occurred",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "upcoming":
        return (
          <Badge
            variant="outline"
            className="border-black text-xs whitespace-nowrap"
          >
            Upcoming
          </Badge>
        );
      case "current":
        return (
          <Badge className="bg-secondary text-secondary-foreground text-xs whitespace-nowrap">
            In Progress
          </Badge>
        );
      case "past":
        return (
          <Badge variant="secondary" className="text-xs whitespace-nowrap">
            Completed
          </Badge>
        );
      default:
        return null;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-secondary text-secondary-foreground text-xs whitespace-nowrap">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="outline"
            className="border-warning text-warning-foreground bg-warning/10 text-xs whitespace-nowrap"
          >
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="text-xs whitespace-nowrap">
            <AlertCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const RaceCard = ({
    race,
    showRegister = false,
  }: {
    race: Race;
    showRegister?: boolean;
  }) => {
    const registered = isRaceRegistered(race.id);
    const registration = getRegistration(race.id);

    return (
      <Card className="group flex flex-col w-full rounded-xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40">
        <CardHeader className="pb-3 px-4 sm:px-6">
          <div className="flex items-start flex-wrap justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base sm:text-lg font-semibold leading-snug">
                {race.title}
              </CardTitle>
              <CardDescription className="mt-1.5 flex items-center gap-1 text-xs sm:text-sm">
                <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                <span className="truncate">{race.venue}</span>
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {getStatusBadge(race.status)}
              {registered &&
                registration &&
                getPaymentBadge(registration.payment_status)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pb-4 px-4 sm:px-6">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
              <span>{format(new Date(race.date), "MMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
              <span>{format(new Date(race.date), "h:mm a")}</span>
            </div>
          </div>
          {race.details && (
            <p className="mt-2.5 text-xs sm:text-sm text-muted-foreground line-clamp-2">
              {race.details}
            </p>
          )}
          <div className="mt-2.5 flex items-center gap-1.5 text-xs sm:text-sm">
            <DollarSign className="h-3.5 w-3.5 text-green-600 shrink-0" />
            <span className="font-medium text-green-600">
              ${Number(race.registration_fee ?? 10).toFixed(2)}
            </span>
            <span className="text-muted-foreground">per runner</span>
          </div>
        </CardContent>
        <CardFooter className="mt-auto flex flex-wrap gap-2 border-t pt-3 pb-4 px-4 sm:px-6">
          <Button
            variant="outline"
            onClick={() => openRaceDetails(race)}
            className="flex-1 h-9 sm:h-10 text-xs sm:text-sm cursor-pointer hover:shadow-md hover:bg-background text-red-700 border-red-700"
          >
            View Details
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
          {showRegister &&
          !registered &&
          
          race?.registration_deadline &&
          new Date(race?.registration_deadline) > new Date() ? (
            <Button
              onClick={() => openRegisterModal(race)}
              className="flex-1 h-9 sm:h-10 text-xs sm:text-sm cursor-pointer hover:shadow-md hover:bg-red-600 text-white bg-[#FF0000]"
            >
              Register
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    );
  };

  const RaceSection = ({
    title,
    races,
    icon: Icon,
    showRegister = false,
  }: {
    title: string;
    races: Race[];
    icon: React.ElementType;
    showRegister?: boolean;
  }) => (
    <div className="space-y-4">
      {races.length === 0 ? (
        <Card className="p-8 sm:p-10 text-center">
          <Icon className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No {title.toLowerCase()}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
          {races.map((race) => (
            <RaceCard key={race.id} race={race} showRegister={showRegister} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
          Races
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Manage race registrations for your teams
        </p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <TabsList className="w-full max-w-xs sm:max-w-md grid grid-cols-3">
            <TabsTrigger
              value="current"
              className="flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm cursor-pointer"
            >
              <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="hidden sm:inline">Current</span>
              <span className="sm:hidden">Now</span>
            </TabsTrigger>
            <TabsTrigger
              value="upcoming"
              className="flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="hidden sm:inline">Upcoming</span>
              <span className="sm:hidden">Soon</span>
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className="flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm cursor-pointer"
            >
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              Past
            </TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search races..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <TabsContent value="current" className="mt-4 sm:mt-6">
          <RaceSection
            title="Current Races"
            races={filteredCurrentRaces}
            icon={Trophy}
            showRegister
          />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-4 sm:mt-6">
          <RaceSection
            title="Upcoming Races"
            races={filteredUpcomingRaces}
            icon={Calendar}
            showRegister
          />
        </TabsContent>
        <TabsContent value="past" className="mt-4 sm:mt-6">
          <RaceSection
            title="Past Races"
            races={filteredPastRaces}
            icon={Clock}
          />
        </TabsContent>
      </Tabs>

      {/* Race Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
          {selectedRace && (
            <>
              <DialogHeader className="pr-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <DialogTitle className="text-base sm:text-xl leading-snug">
                      {selectedRace.title}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-1 mt-1 text-xs sm:text-sm">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{selectedRace.venue}</span>
                    </DialogDescription>
                  </div>
                  {getStatusBadge(selectedRace.status)}
                </div>
              </DialogHeader>

              <div className="space-y-4 sm:space-y-5 py-3">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border">
                    <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm font-semibold leading-snug">
                        {format(
                          new Date(selectedRace.date),
                          "EEE, MMM d, yyyy",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border">
                    <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Time</p>
                      <p className="text-sm font-semibold">
                        {format(new Date(selectedRace.date), "h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border">
                    <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Venue</p>
                      <p className="text-sm font-semibold truncate">
                        {selectedRace.venue}
                      </p>
                    </div>
                  </div>
                  {(selectedRace.start_location ||
                    selectedRace.end_location) && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border">
                      <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                        <Trophy className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Route</p>
                        <p className="text-sm font-semibold">
                          {(selectedRace.waypoints?.filter(Boolean).length ??
                            0) >= 2
                            ? selectedRace
                                .waypoints!.filter(Boolean)
                                .join(" → ")
                            : `${selectedRace.start_location || "—"} → ${selectedRace.end_location || "—"}`}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedRace.registration_deadline && (
                    <div
                      className={`flex items-start gap-2.5 p-3 rounded-lg border ${
                        new Date(selectedRace.registration_deadline) <
                        new Date()
                          ? "bg-destructive/5 border-destructive/30"
                          : "bg-warning/5 border-warning/30"
                      }`}
                    >
                      <div className="p-1.5 rounded-md bg-orange-100 shrink-0">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          Registration Deadline
                        </p>
                        <p className="text-sm font-semibold leading-snug">
                          {format(
                            new Date(selectedRace.registration_deadline),
                            "MMM d, yyyy",
                          )}
                        </p>
                        {new Date(selectedRace.registration_deadline) <
                          new Date() && (
                          <p className="text-xs text-destructive font-medium mt-0.5">
                            Deadline passed
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-lg border bg-green-50 border-green-200">
                  <div className="p-1.5 rounded-md bg-green-100 shrink-0">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Registration Fee
                    </p>
                    <p className="text-sm font-semibold text-green-700">
                      ${Number(selectedRace.registration_fee ?? 10).toFixed(2)}{" "}
                      per runner
                    </p>
                    <p className="text-xs text-muted-foreground">
                      10 runners per sub-team = $
                      {(
                        Number(selectedRace.registration_fee ?? 10) * 10
                      ).toFixed(2)}{" "}
                      per sub-team
                    </p>
                  </div>
                </div>

                {isRaceRegistered(selectedRace.id) ? (
                  <div className="flex items-center gap-3 p-3 sm:p-4 rounded-lg bg-green-50 border border-green-200">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-green-800">
                        Your team is registered!
                      </p>
                      {(() => {
                        const reg = getRegistration(selectedRace.id);
                        return reg ? (
                          <p className="text-xs text-green-600 mt-0.5 capitalize">
                            Payment: {reg.payment_status}
                          </p>
                        ) : null;
                      })()}
                    </div>
                  </div>
                ) : (
                  selectedRace.status !== "past" && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />
                      {selectedRace.registration_deadline &&
                      new Date(selectedRace.registration_deadline) >
                        new Date() ? (
                        <p className="text-xs sm:text-sm text-blue-700">
                          Registration is open — click{" "}
                          <strong>Register Now</strong> to enrol your team.
                        </p>
                      ) : (
                        <p className="text-xs sm:text-sm text-blue-700">
                          Registration is closed.
                        </p>
                      )}
                    </div>
                  )
                )}

                {selectedRace.details && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-semibold text-sm sm:text-base">
                        Details
                      </h4>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/40 border text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedRace.details}
                    </div>
                  </div>
                )}

                {selectedRace.rules && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-semibold text-sm sm:text-base">
                        Rules & Regulations
                      </h4>
                    </div>
                    <div className="p-3 sm:p-4 rounded-lg bg-muted/50 border text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedRace.rules}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailModal(false)}
                  className="w-full bg-white cursor-pointer sm:w-auto text-sm"
                >
                  Close
                </Button>
                {selectedRace.status !== "past" &&
                !isRaceRegistered(selectedRace.id) &&
                
                selectedRace.registration_deadline &&
                new Date(selectedRace.registration_deadline) > new Date() ? (
                  <Button
                    className="w-full sm:w-auto text-sm cursor-pointer bg-red-600 hover:bg-red-700"
                    onClick={() => {
                      setShowDetailModal(false);
                      openRegisterModal(selectedRace);
                    }}
                  >
                    Register Now
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Registration Workflow Modal */}
      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-lg sm:max-w-2xl lg:max-w-4xl h-[95dvh] max-h-[95dvh] flex flex-col overflow-hidden rounded-xl p-4 sm:p-6 top-[50%]">
          {selectedRace && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg pr-6 leading-snug">
                  Register for {selectedRace.title}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {step === 1 &&
                    "Select your team and choose which sub-teams to register (10 runners each)"}
                  {step === 2 &&
                    `Select ${requiredRunners} runners for your ${selectedSubTeamTypes.length} sub-team${selectedSubTeamTypes.length !== 1 ? "s" : ""}`}
                  {step === 3 &&
                    "Drag runners to set their order — leg numbers are assigned automatically"}
                </DialogDescription>

                {/* Step indicator */}
                <div className="flex items-center gap-2 mt-2">
                  {[1, 2, 3].map((s) => (
                    <React.Fragment key={s}>
                      <div
                        className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold ${
                          step === s
                            ? "bg-[#FF0000] text-white"
                            : step > s
                              ? "bg-green-500 text-white"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {step > s ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          s
                        )}
                      </div>
                      {s < 3 && (
                        <div
                          className={`flex-1 h-0.5 ${step > s ? "bg-green-500" : "bg-muted"}`}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto pr-1 -mr-1">
                {/* Step 1 — Team + Sub-team selection */}
                {step === 1 && (
                  <div className="space-y-5 py-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="team" className="text-sm">
                        Select Your Team
                      </Label>
                      <Select
                        value={selectedTeamId}
                        onValueChange={setSelectedTeamId}
                      >
                        <SelectTrigger
                          id="team"
                          className="w-full cursor-pointer h-9 sm:h-10 text-sm"
                        >
                          <SelectValue placeholder="Select a team" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((team) => (
                            <SelectItem
                              key={team.id}
                              value={team.id}
                              className="text-sm"
                            >
                              {team.name} ({team.members?.length || 0} runners)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedTeamId && (
                      <>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm sm:text-base font-medium">
                              Select Sub-Teams (1–3)
                            </Label>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                              Each sub-team requires 10 runners.
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                            {[
                              {
                                type: "male" as SubTeamType,
                                label: "Male",
                                desc: "10 male runners",
                              },
                              {
                                type: "female" as SubTeamType,
                                label: "Female",
                                desc: "10 female runners",
                              },
                              {
                                type: "co-ed" as SubTeamType,
                                label: "Co-ed",
                                desc: "Mixed gender (10 runners)",
                              },
                            ].map(({ type, label, desc }) => (
                              <div
                                key={type}
                                onClick={() => toggleSubTeamType(type)}
                                className={`relative flex items-start gap-3 p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                                  selectedSubTeamTypes.includes(type)
                                    ? "border-accent bg-accent/5 shadow-md"
                                    : "border-border hover:border-accent/50 hover:bg-muted/30"
                                }`}
                              >
                                <Checkbox
                                  id={`subteam-${type}`}
                                  checked={selectedSubTeamTypes.includes(type)}
                                  onCheckedChange={() =>
                                    toggleSubTeamType(type)
                                  }
                                  className="mt-0.5 data-[state=checked]:bg-black data-[state=checked]:border-black shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <Label
                                    htmlFor={`subteam-${type}`}
                                    className="font-semibold cursor-pointer text-sm sm:text-base"
                                  >
                                    {label}
                                  </Label>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {desc}
                                  </p>
                                </div>
                                {selectedSubTeamTypes.includes(type) && (
                                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-accent absolute top-2 right-2 shrink-0" />
                                )}
                              </div>
                            ))}
                          </div>

                          {selectedSubTeamTypes.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 p-2.5 sm:p-3 bg-accent/10 border border-accent/30 rounded-lg">
                              <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent shrink-0" />
                              <span className="text-xs sm:text-sm">
                                <strong>{selectedSubTeamTypes.length}</strong>{" "}
                                sub-team
                                {selectedSubTeamTypes.length !== 1 ? "s" : ""}
                                {" • "}
                                <strong>{requiredRunners}</strong> runners
                                needed{" • "}
                                <strong>${totalFee}</strong> total fee
                              </span>
                            </div>
                          )}
                        </div>

                        <Card className="bg-muted/30">
                          <CardHeader className="pb-2 px-4 pt-4">
                            <CardTitle className="text-sm sm:text-base">
                              Registration Rules
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-xs sm:text-sm px-4 pb-4">
                            {[
                              {
                                icon: Users,
                                text: `10 runners required per sub-team`,
                              },
                              {
                                icon: AlertTriangle,
                                text: `Each runner can participate in max ${MAX_LEGS_PER_RUNNER} races`,
                              },
                              {
                                icon: UserX,
                                text: "No runner can be in multiple sub-teams",
                              },
                              {
                                icon: DollarSign,
                                text: `$${feePerRunner} per runner registration fee`,
                              },
                            ].map(({ icon: Icon, text }) => (
                              <div
                                key={text}
                                className="flex items-center gap-2"
                              >
                                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600 shrink-0" />
                                <span>{text}</span>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </div>
                )}

                {/* Step 2 — Runner selection */}
                {step === 2 && (
                  <div className="flex flex-col gap-4 py-3 h-full">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-muted-foreground">
                          Total Selected
                        </span>
                        <span className="font-medium">
                          {totalSelectedRunners} / {requiredRunners}
                        </span>
                      </div>
                      <Progress
                        value={(totalSelectedRunners / requiredRunners) * 100}
                        className="h-2 [&>div]:bg-accent"
                      />
                    </div>

                    <Tabs
                      value={activeSubTeam}
                      onValueChange={(v) => setActiveSubTeam(v as SubTeamType)}
                    >
                      <TabsList
                        className={`grid w-full ${
                          selectedSubTeamTypes.length === 1
                            ? "grid-cols-1"
                            : selectedSubTeamTypes.length === 2
                              ? "grid-cols-2"
                              : "grid-cols-3"
                        }`}
                      >
                        {(["male", "female", "co-ed"] as SubTeamType[])
                          .filter((t) => selectedSubTeamTypes.includes(t))
                          .map((type) => (
                            <TabsTrigger
                              key={type}
                              value={type}
                              className="text-xs sm:text-sm gap-1.5"
                            >
                              <span className="capitalize">{type}</span>
                              <Badge
                                variant={
                                  (runnersBySubTeam[type]?.length || 0) === 10
                                    ? "default"
                                    : "secondary"
                                }
                                className={`ml-1 text-xs h-4 px-1.5 ${(runnersBySubTeam[type]?.length || 0) === 10 ? "bg-accent" : ""}`}
                              >
                                {runnersBySubTeam[type]?.length || 0}/10
                              </Badge>
                            </TabsTrigger>
                          ))}
                      </TabsList>

                      <div className="mt-3">
                        <ScrollArea className="flex-1 min-h-0 rounded-lg border bg-muted/30 p-3">
                          {filteredRunners.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <UserX className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">
                                No eligible runners for this sub-team
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {filteredRunners.map((runner) => {
                                const isSelected = runnersBySubTeam[
                                  activeSubTeam
                                ]?.includes(runner.id);
                                const isSelectedElsewhere =
                                  isRunnerSelectedElsewhere(
                                    runner.id,
                                    activeSubTeam,
                                  );
                                const maxLegsReached = hasReachedMaxLegs(
                                  runner.id,
                                );
                                const isDisabled =
                                  isSelectedElsewhere || maxLegsReached;

                                return (
                                  <div
                                    key={runner.id}
                                    onClick={() =>
                                      !isDisabled && toggleRunner(runner.id)
                                    }
                                    className={`flex items-center justify-between p-3 sm:p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                                      isSelected
                                        ? "border-accent bg-accent/5 shadow-sm"
                                        : isDisabled
                                          ? "border-muted bg-muted/50 opacity-60 cursor-not-allowed"
                                          : "border-border hover:border-accent/50 hover:bg-muted/30"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                      <Checkbox
                                        checked={isSelected}
                                        disabled={isDisabled}
                                        onCheckedChange={() =>
                                          !isDisabled && toggleRunner(runner.id)
                                        }
                                        className="data-[state=checked]:bg-black data-[state=checked]:border-black shrink-0"
                                      />
                                      <div className="min-w-0">
                                        <p className="font-medium text-xs sm:text-sm truncate">
                                          {getRunnerName(runner)}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs text-muted-foreground mt-0.5">
                                          <span>
                                            {runner.age
                                              ? `${runner.age} yrs`
                                              : "Age N/A"}
                                          </span>
                                          <span>•</span>
                                          <span className="capitalize">
                                            {runner.gender || "Unknown"}
                                          </span>
                                          {runnerRaceCount[runner.id] && (
                                            <>
                                              <span>•</span>
                                              <span>
                                                {runnerRaceCount[runner.id]}{" "}
                                                race(s)
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                      {isSelectedElsewhere && (
                                        <Badge
                                          variant="secondary"
                                          className="text-xs hidden sm:inline-flex"
                                        >
                                          In another sub-team
                                        </Badge>
                                      )}
                                      {maxLegsReached && (
                                        <Badge
                                          variant="destructive"
                                          className="text-xs hidden sm:inline-flex"
                                        >
                                          Max legs
                                        </Badge>
                                      )}
                                      {isSelected && (
                                        <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-accent shrink-0" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </Tabs>

                    <Separator />
                    <div className="flex items-center justify-between bg-accent/5 border border-accent/20 p-3 sm:p-4 rounded-lg">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 shrink-0" />
                        <span className="font-medium text-sm sm:text-base">
                          Total Fee
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xl sm:text-2xl font-bold text-red-600">
                          ${totalFee.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedSubTeamTypes.length} sub-team
                          {selectedSubTeamTypes.length !== 1 ? "s" : ""} × 10 ×
                          ${feePerRunner}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3 — Leg assignment via drag and drop */}
                {step === 3 && (
                  <div className="space-y-4 py-3">
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-xs sm:text-sm text-blue-700">
                        Drag runners to set their order. Each runner is
                        automatically assigned 3 legs based on their position.
                        Runner #1 gets legs 1, 11, 21 — Runner #2 gets legs 2,
                        12, 22, and so on.
                      </p>
                    </div>

                    <Tabs
                      value={activeSubTeam}
                      onValueChange={(v) => setActiveSubTeam(v as SubTeamType)}
                    >
                      <TabsList
                        className={`grid w-full ${
                          selectedSubTeamTypes.length === 1
                            ? "grid-cols-1"
                            : selectedSubTeamTypes.length === 2
                              ? "grid-cols-2"
                              : "grid-cols-3"
                        }`}
                      >
                        {(["male", "female", "co-ed"] as SubTeamType[])
                          .filter((t) => selectedSubTeamTypes.includes(t))
                          .map((type) => (
                            <TabsTrigger
                              key={type}
                              value={type}
                              className="text-xs sm:text-sm capitalize"
                            >
                              {type}
                            </TabsTrigger>
                          ))}
                      </TabsList>

                      <div className="mt-3 space-y-2">
                        {/* Column headers */}
                        <div className="grid grid-cols-[2rem_1fr_auto] gap-2 px-3 py-1">
                          <span className="text-xs text-muted-foreground font-medium">
                            #
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            Runner
                          </span>
                          <span className="text-xs text-muted-foreground font-medium text-right">
                            Legs
                          </span>
                        </div>

                        <ScrollArea className="h-[320px] sm:h-[400px]">
                          <div className="space-y-1.5 pr-2">
                            {(orderedRunners[activeSubTeam] || []).map(
                              (runnerId, index) => {
                                const runner = getRunnerById(runnerId);
                                const legs = getLegsForPosition(index);

                                return (
                                  <div
                                    key={runnerId}
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDragEnter={() => handleDragEnter(index)}
                                    onDragEnd={() =>
                                      handleDragEnd(activeSubTeam)
                                    }
                                    onDragOver={(e) => e.preventDefault()}
                                    className={`grid grid-cols-[2rem_1fr_auto] gap-2 items-center p-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing select-none ${
                                      draggingIndex === index
                                        ? "opacity-40 border-accent bg-accent/10 scale-95"
                                        : dragOverIndex === index &&
                                            draggingIndex !== index
                                          ? "border-[#FF0000] bg-[#FF0000]/5 border-dashed"
                                          : "bg-card hover:border-accent/50 hover:bg-accent/5"
                                    }`}
                                  >
                                    <div className="flex items-center gap-1">
                                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                                    </div>

                                    {/* Runner info */}
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-xs font-semibold shrink-0">
                                          {index + 1}
                                        </span>
                                        <p className="font-medium text-xs sm:text-sm truncate">
                                          {runner
                                            ? getRunnerName(runner)
                                            : runnerId}
                                        </p>
                                      </div>
                                      {runner && (
                                        <p className="text-xs text-muted-foreground ml-7 mt-0.5 capitalize">
                                          {runner.gender}{" "}
                                          {runner.age ? `• ${runner.age}y` : ""}
                                        </p>
                                      )}
                                    </div>

                                    {/* Leg badges */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      {legs.map((leg) => (
                                        <span
                                          key={leg}
                                          className="flex items-center justify-center h-6 min-w-[1.5rem] px-1 rounded bg-[#FF0000]/10 text-[#FF0000] text-xs font-bold border border-[#FF0000]/20"
                                        >
                                          {leg}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </Tabs>

                    {/* Fee summary */}
                    <Separator />
                    <div className="flex items-center justify-between bg-accent/5 border border-accent/20 p-3 sm:p-4 rounded-lg">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 shrink-0" />
                        <span className="font-medium text-sm sm:text-base">
                          Total Fee
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xl sm:text-2xl font-bold text-red-600">
                          ${totalFee.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedSubTeamTypes.length} sub-team
                          {selectedSubTeamTypes.length !== 1 ? "s" : ""} × 10 ×
                          ${feePerRunner}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <DialogFooter className="flex-col sm:flex-row gap-2 mt-3 pt-3 border-t">
                {step === 1 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowRegisterModal(false)}
                      className="w-full sm:w-auto cursor-pointer bg-white text-sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (selectedSubTeamTypes.length === 0) {
                          toast({
                            variant: "destructive",
                            title: "Select sub-teams",
                            description: "Please select at least one sub-team.",
                          });
                          return;
                        }
                        setActiveSubTeam(selectedSubTeamTypes[0]);
                        setStep(2);
                      }}
                      disabled={
                        !selectedTeamId || selectedSubTeamTypes.length === 0
                      }
                      className="w-full sm:w-auto bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer text-sm"
                    >
                      Continue to Runner Selection
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </>
                )}

                {step === 2 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="w-full sm:w-auto cursor-pointer bg-white text-sm"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => {
                        const errors = validateSelection();
                        if (errors.length > 0) {
                          toast({
                            variant: "destructive",
                            title: "Validation failed",
                            description: errors[0],
                          });
                          return;
                        }
                        initOrderedRunners();
                        setActiveSubTeam(selectedSubTeamTypes[0]);
                        setStep(3);
                      }}
                      disabled={totalSelectedRunners !== requiredRunners}
                      className="w-full sm:w-auto bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer text-sm"
                    >
                      Continue to Leg Assignment
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </>
                )}

                {step === 3 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setStep(2)}
                      className="w-full sm:w-auto cursor-pointer bg-white text-sm"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleProceedToPayment}
                      disabled={isRegistering}
                      className="w-full sm:w-auto bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer text-sm"
                    >
                      {isRegistering ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <DollarSign className="mr-1 h-4 w-4" />
                          Proceed to Payment (${totalFee})
                        </>
                      )}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
