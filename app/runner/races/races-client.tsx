"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
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
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { Race, Registration, Team, TeamMember } from "./page";
import Link from "next/link";

interface RacesClientProps {
  userId: string;
  upcomingRaces: Race[];
  pastRaces: Race[];
  teams: Team[];
  registrations: Registration[];
  teamMembers: TeamMember[];
}

// ── Timezone-safe date helpers ──────────────────────────────────────────────
// Treat stored date strings as local dates (strip the time component for display)
function parseDateSafe(dateString: string): Date {
  // If it's an ISO string with time, parse it normally
  // If it's date-only (YYYY-MM-DD), parse as local midnight to avoid timezone shift
  if (dateString.includes("T")) {
    return parseISO(dateString);
  }
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatRaceDate(dateString: string): string {
  return format(parseDateSafe(dateString), "MMM d, yyyy");
}

function formatRaceTime(dateString: string): string {
  // Only show time if there's actually a time component in the string
  if (!dateString.includes("T")) return "";
  const date = parseDateSafe(dateString);
  // If time is exactly midnight UTC, likely no time was set — don't show it
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (hours === 0 && minutes === 0) return "";
  return format(date, "h:mm a");
}

export function RacesClient({
  userId,
  upcomingRaces,
  pastRaces,
  teams,
  registrations,
  teamMembers,
}: RacesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setSearchQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  // Silently refresh when races or registrations change
  useEffect(() => {
    const { createClient } = require("@/lib/supabase/client")
    const supabase = createClient()
    const channel = supabase
      .channel("runner-races-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "races" }, () => {
        router.refresh()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations" }, () => {
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Silently refresh when races or registrations change
  useEffect(() => {
    const { createClient } = require("@/lib/supabase/client")
    const supabase = createClient()
    const channel = supabase
      .channel("runner-races-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "races" }, () => {
        router.refresh()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations" }, () => {
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const filterRaces = (raceList: Race[]) => {
    if (!searchQuery.trim()) return raceList;
    const q = searchQuery.toLowerCase();
    return raceList.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.venue.toLowerCase().includes(q) ||
        (r.start_location ?? "").toLowerCase().includes(q) ||
        (r.end_location ?? "").toLowerCase().includes(q) ||
        (r.waypoints ?? []).some(w => w.toLowerCase().includes(q))
    );
  };

  const filteredUpcomingRaces = useMemo(() => filterRaces(upcomingRaces), [upcomingRaces, searchQuery]);
  const filteredPastRaces = useMemo(() => filterRaces(pastRaces), [pastRaces, searchQuery]);

  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const isRaceRegistered = (raceId: string) =>
    registrations.some((r) => r.race_id === raceId);

  const getRegistration = (raceId: string) =>
    registrations.find((r) => r.race_id === raceId);

  const isRunnerInTeam = teams.some(
    (team) => team.manager_id === userId || team.members?.includes(userId)
  );

  const openRaceDetails = (race: Race) => {
    setSelectedRace(race);
    setShowDetailModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "upcoming":
        return <Badge variant="outline" className="border-blue-500 text-blue-600 text-xs whitespace-nowrap">Upcoming</Badge>;
      case "current":
        return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs whitespace-nowrap">In Progress</Badge>;
      case "past":
        return <Badge variant="secondary" className="text-xs whitespace-nowrap">Completed</Badge>;
      default:
        return null;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs whitespace-nowrap">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="border-yellow-400 text-yellow-600 text-xs whitespace-nowrap">
            <Clock className="mr-1 h-3 w-3" /> Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="text-xs whitespace-nowrap">
            <AlertCircle className="mr-1 h-3 w-3" /> Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  // ─── RACE CARD ──────────────────────────────────────────────────────────────
  const RaceCard = ({ race }: { race: Race }) => {
    const registered = isRaceRegistered(race.id);
    const registration = getRegistration(race.id);
    const raceTime = formatRaceTime(race.date);

    // Check if deadline is approaching (within 3 days)
    const deadlineApproaching = race.registration_deadline
      ? (() => {
          const deadline = parseDateSafe(race.registration_deadline);
          const now = new Date();
          const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return daysUntil > 0 && daysUntil <= 3;
        })()
      : false;

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
              {registered && registration && getPaymentBadge(registration.payment_status)}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 pb-4 px-4 sm:px-6 space-y-2">
          {/* Date + time */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{formatRaceDate(race.date)}</span>
            </div>
            {raceTime && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{raceTime}</span>
              </div>
            )}
          </div>

          {/* Registration deadline */}
          {race.registration_deadline && race.status !== "past" && (
            <div className={`flex items-center gap-1.5 text-xs rounded-md px-2 py-1 w-fit ${
              deadlineApproaching
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-orange-50 text-orange-600 border border-orange-100"
            }`}>
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>
                Deadline: {formatRaceDate(race.registration_deadline)}
                {deadlineApproaching && " (Soon!)"}
              </span>
            </div>
          )}

          {race.details && (
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              {race.details}
            </p>
          )}
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
        </CardFooter>
      </Card>
    );
  };

  // ─── EMPTY STATE ────────────────────────────────────────────────────────────
  const EmptyState = ({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) => (
    <Card className="p-8 sm:p-12 text-center">
      <Icon className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/50" />
      <h3 className="mt-4 text-base sm:text-lg font-medium">{title}</h3>
      <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
    </Card>
  );

  return (
    <div className="space-y-6 sm:space-y-8 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Races</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Browse upcoming races and view your race history
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="upcoming" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <TabsList className="w-full max-w-xs sm:max-w-md">
            <TabsTrigger value="upcoming" className="flex-1 flex items-center justify-center gap-1.5 text-xs sm:text-sm">
              <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Upcoming ({filteredUpcomingRaces.length})</span>
            </TabsTrigger>
            <TabsTrigger value="past" className="flex-1 flex items-center justify-center gap-1.5 text-xs sm:text-sm">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Past ({filteredPastRaces.length})</span>
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

        <TabsContent value="upcoming" className="mt-4 sm:mt-6">
          {filteredUpcomingRaces.length === 0 ? (
            <EmptyState icon={Trophy} title={searchQuery ? "No races match your search" : "No upcoming races"} subtitle={searchQuery ? "Try a different search term" : "Check back soon for new race announcements"} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
              {filteredUpcomingRaces.map((race) => (
                <RaceCard key={race.id} race={race} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4 sm:mt-6">
          {filteredPastRaces.length === 0 ? (
            <EmptyState icon={Clock} title={searchQuery ? "No races match your search" : "No past races"} subtitle={searchQuery ? "Try a different search term" : "Your completed races will appear here"} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
              {filteredPastRaces.map((race) => (
                <RaceCard key={race.id} race={race} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Race Detail Modal ── */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
          {selectedRace && (
            <>
              <DialogHeader className="pr-8">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <DialogTitle className="text-base sm:text-xl leading-snug">
                      {selectedRace.title}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-1 mt-1 text-xs sm:text-sm">
                      <MapPin className="h-3.5 w-3.5 text-red-600 shrink-0" />
                      <span className="truncate">{selectedRace.venue}</span>
                    </DialogDescription>
                  </div>
                  {getStatusBadge(selectedRace.status)}
                </div>
              </DialogHeader>

              <div className="space-y-4 sm:space-y-5 py-3">
                {/* Key info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border">
                    <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm font-semibold leading-snug">
                        {format(parseDateSafe(selectedRace.date), "EEE, MMM d, yyyy")}
                      </p>
                    </div>
                  </div>

                  {formatRaceTime(selectedRace.date) && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border">
                      <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Time</p>
                        <p className="text-sm font-semibold">{formatRaceTime(selectedRace.date)}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border">
                    <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Venue</p>
                      <p className="text-sm font-semibold truncate">{selectedRace.venue}</p>
                    </div>
                  </div>

                  {(selectedRace.start_location || selectedRace.end_location) && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border">
                      <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                        <Trophy className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Route</p>
                        <p className="text-sm font-semibold">
                          {(selectedRace.waypoints?.filter(Boolean).length ?? 0) >= 2
                            ? selectedRace.waypoints!.filter(Boolean).join(" → ")
                            : `${selectedRace.start_location || "—"} → ${selectedRace.end_location || "—"}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedRace.registration_deadline && (
                    <div className={`flex items-start gap-2.5 p-3 rounded-lg border ${
                      parseDateSafe(selectedRace.registration_deadline) < new Date()
                        ? "bg-destructive/5 border-destructive/30"
                        : "bg-orange-50 border-orange-200"
                    }`}>
                      <div className="p-1.5 rounded-md bg-orange-100 shrink-0">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Registration Deadline</p>
                        <p className="text-sm font-semibold leading-snug">
                          {formatRaceDate(selectedRace.registration_deadline)}
                        </p>
                        {parseDateSafe(selectedRace.registration_deadline) < new Date() && (
                          <p className="text-xs text-destructive font-medium mt-0.5">Deadline passed</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Registration status */}
                {isRaceRegistered(selectedRace.id) ? (
                  <div className="flex items-start gap-3 p-3 sm:p-4 rounded-lg bg-green-50 border border-green-200">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm text-green-800">Your team is registered!</p>
                      {getRegistration(selectedRace.id)?.payment_status === "pending" && (
                        <p className="mt-0.5 text-xs text-green-600">
                          Payment pending — your team manager needs to complete the payment to confirm your spot.
                        </p>
                      )}
                    </div>
                  </div>
                ) : selectedRace.status !== "past" && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />
                    <p className="text-xs sm:text-sm text-blue-700">
                      Not yet registered — contact your team manager to register for this race.
                    </p>
                  </div>
                )}

                {selectedRace.details && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-semibold text-sm sm:text-base">Details</h4>
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
                      <h4 className="font-semibold text-sm sm:text-base">Rules & Regulations</h4>
                    </div>
                    <div className="p-3 sm:p-4 rounded-lg bg-muted/50 border text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedRace.rules}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" className="w-full sm:w-auto cursor-pointer text-sm" onClick={() => setShowDetailModal(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
