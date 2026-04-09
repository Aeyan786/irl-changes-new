"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createRace, updateRace, deleteRace } from "@/app/actions/races";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Search,
  Trash2,
  Trophy,
  Calendar,
  MapPin,
  Loader2,
  Eye,
  X,
  ArrowDown,
} from "lucide-react";

type Race = {
  id: string;
  title: string;
  date: string;
  venue: string;
  start_location: string | null;
  end_location: string | null;
  waypoints: string[] | null;
  registration_deadline: string | null;
  registration_fee: number;
  details: string | null;
  rules: string | null;
  status: "past" | "current" | "upcoming";
  created_at: string;
};

const raceSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  date: z.string().min(1, "Date is required"),
  venue: z.string().min(1, "Venue is required").max(200, "Venue too long"),
  registration_deadline: z.string().optional(),
  registration_fee: z.coerce
    .number()
    .min(0, "Fee cannot be negative")
    .default(10),
  details: z.string().optional(),
  rules: z.string().optional(),
});

type RaceFormData = z.infer<typeof raceSchema>;

// ── Route Builder Component ───────────────────────────────────────────────
function RouteBuilder({
  waypoints,
  onChange,
}: {
  waypoints: string[];
  onChange: (waypoints: string[]) => void;
}) {
  const startCity = waypoints[0] || "";
  const endCity = waypoints[waypoints.length - 1] || "";
  const middleCities = waypoints.slice(1, -1);

  const updateStart = (val: string) => {
    const updated = [...waypoints];
    updated[0] = val;
    onChange(updated);
  };

  const updateEnd = (val: string) => {
    const updated = [...waypoints];
    updated[updated.length - 1] = val;
    onChange(updated);
  };

  const updateMiddle = (index: number, val: string) => {
    const updated = [...waypoints];
    updated[index + 1] = val;
    onChange(updated);
  };

  const addMiddleCity = (afterIndex: number) => {
    const updated = [...waypoints];
    updated.splice(afterIndex + 1, 0, "");
    onChange(updated);
  };

  const removeMiddleCity = (index: number) => {
    const updated = [...waypoints];
    updated.splice(index + 1, 1);
    onChange(updated);
  };

  return (
    <div className="space-y-1">
      <Label>Route</Label>
      <p className="text-xs text-muted-foreground mb-2">
        Add cities along the race route in order
      </p>

      <div className="relative">
        {/* Vertical line connecting dots */}
        <div className="absolute left-[11px] top-6 bottom-6 w-0.5 bg-border z-0" />

        <div className="space-y-1 relative z-10">
          {/* Starting City */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div className="h-5 w-5 rounded-full bg-green-500 border-2 border-white shadow flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              </div>
            </div>
            <div className="flex-1">
              <Input
                value={startCity}
                onChange={(e) => updateStart(e.target.value)}
                placeholder="Starting City (e.g., New York)"
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Add city button after start */}
          <div className="flex items-center gap-3 py-0.5">
            <div className="w-5 flex justify-center">
              <button
                type="button"
                onClick={() => addMiddleCity(0)}
                className="h-5 w-5 rounded-full border-2 border-dashed border-muted-foreground/40 hover:border-primary hover:bg-primary/5 flex items-center justify-center transition-colors group"
                title="Add city"
              >
                <Plus className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground/50">Add city</span>
          </div>

          {/* Middle Cities */}
          {middleCities.map((city, index) => (
            <div key={index}>
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <div className="h-5 w-5 rounded-full bg-blue-500 border-2 border-white shadow flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">
                      {index + 2}
                    </span>
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    value={city}
                    onChange={(e) => updateMiddle(index, e.target.value)}
                    placeholder={`City ${index + 2} (e.g., Miami)`}
                    className="h-9 text-sm flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeMiddleCity(index)}
                    className="h-7 w-7 rounded-md hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors shrink-0"
                    title="Remove city"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Add city button after each middle city */}
              <div className="flex items-center gap-3 py-0.5">
                <div className="w-5 flex justify-center">
                  <button
                    type="button"
                    onClick={() => addMiddleCity(index + 1)}
                    className="h-5 w-5 rounded-full border-2 border-dashed border-muted-foreground/40 hover:border-primary hover:bg-primary/5 flex items-center justify-center transition-colors group"
                    title="Add city"
                  >
                    <Plus className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground/50">
                  Add city
                </span>
              </div>
            </div>
          ))}

          {/* Ending City */}
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <div className="h-5 w-5 rounded-full bg-red-500 border-2 border-white shadow flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              </div>
            </div>
            <div className="flex-1">
              <Input
                value={endCity}
                onChange={(e) => updateEnd(e.target.value)}
                placeholder="Ending City (e.g., Bostun)"
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Route Preview */}
      {waypoints.filter(Boolean).length >= 2 && (
        <div className="mt-3 p-2.5 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground mb-1 font-medium">
            Route Preview
          </p>
          <div className="flex items-center flex-wrap gap-1 text-xs">
            {waypoints.filter(Boolean).map((city, index) => (
              <span key={index} className="flex items-center gap-1">
                <span
                  className={`font-medium ${
                    index === 0
                      ? "text-green-600"
                      : index === waypoints.filter(Boolean).length - 1
                        ? "text-red-600"
                        : "text-blue-600"
                  }`}
                >
                  {city}
                </span>
                {index < waypoints.filter(Boolean).length - 1 && (
                  <span className="text-muted-foreground">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function RaceForm({
  form,
  onSubmit,
  submitLabel,
  waypoints,
  onWaypointsChange,
  submitting,
}: {
  form: ReturnType<typeof useForm<RaceFormData>>;
  onSubmit: (data: RaceFormData) => void;
  submitLabel: string;
  waypoints: string[];
  onWaypointsChange: (wp: string[]) => void;
  submitting: boolean;
}) {
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="e.g., Spring Marathon 2026"
        />
        {form.formState.errors.title && (
          <p className="text-sm text-destructive">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">
          Date & Time *{" "}
          <span className="text-xs font-normal text-muted-foreground ml-1">
            (Central Time)
          </span>
        </Label>
        <Input
          id="date"
          type="datetime-local"
          min={new Date().toISOString().slice(0, 16)}
          {...form.register("date", {
            validate: (value) => {
              return (
                new Date(value) >= new Date() || "Past date/time not allowed"
              );
            },
          })}
          className="[color-scheme:light]"
        />
        {form.formState.errors.date && (
          <p className="text-sm text-destructive">
            {form.formState.errors.date.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="venue">Venue *</Label>
        <Input
          id="venue"
          {...form.register("venue")}
          placeholder="e.g., Central Park, New York"
        />
        {form.formState.errors.venue && (
          <p className="text-sm text-destructive">
            {form.formState.errors.venue.message}
          </p>
        )}
      </div>

      {/* ── Route Builder ── */}
      <RouteBuilder waypoints={waypoints} onChange={onWaypointsChange} />

      <div className="space-y-2">
        <Label htmlFor="registration_deadline">
          Registration Deadline{" "}
          <span className="text-xs font-normal text-muted-foreground ml-1">
            (Central Time)
          </span>
        </Label>
        <Input
          id="registration_deadline"
          type="datetime-local"
          {...form.register("registration_deadline")}
          className="[color-scheme:light]"
        />
        <p className="text-xs text-muted-foreground">
          Teams cannot register after this date
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="registration_fee">
          Registration Fee (per runner) *
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
            $
          </span>
          <Input
            id="registration_fee"
            type="number"
            min="0"
            className="pl-7"
            {...form.register("registration_fee")}
            placeholder="10"
          />
        </div>
        {form.formState.errors.registration_fee && (
          <p className="text-sm text-destructive">
            {form.formState.errors.registration_fee.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          This fee is charged per runner. A team with 10 runners pays 10× this
          amount.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="details">Details</Label>
        <Textarea
          id="details"
          maxLength={2000}
          {...form.register("details")}
          placeholder="Race description, categories, prizes, etc."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rules">Rules & Regulations</Label>
        <Textarea
          id="rules"
          maxLength={2000}
          {...form.register("rules")}
          placeholder="Race rules, eligibility, disqualification criteria, etc."
          rows={4}
        />
      </div>

      <DialogFooter>
        <Button
          type="submit"
          className="cursor-pointer hover:shadow-xl bg-[#EE0505] hover:bg-red-700"
          disabled={submitting}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function AdminRacesPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [races, setRaces] = useState<Race[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Route waypoints state — managed separately from react-hook-form
  const [createWaypoints, setCreateWaypoints] = useState<string[]>(["", ""]);
  const [editWaypoints, setEditWaypoints] = useState<string[]>(["", ""]);

  const { toast } = useToast();

  useEffect(() => {
    setSearchQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  const createForm = useForm<RaceFormData>({
    resolver: zodResolver(raceSchema),
    defaultValues: {
      title: "",
      date: "",
      venue: "",
      registration_deadline: "",
      registration_fee: 10,
      details: "",
      rules: "",
    },
  });

  const editForm = useForm<RaceFormData>({
    resolver: zodResolver(raceSchema),
  });

  useEffect(() => {
    loadRaces();
  }, []);

  async function loadRaces() {
    const supabase = createClient();
    const { data } = await supabase
      .from("races")
      .select("*")
      .order("date", { ascending: false });

    const now = new Date();
    const racesWithStatus = (data || []).map((race) => {
      const raceDate = new Date(race.date);
      const deadline = race.registration_deadline
        ? new Date(race.registration_deadline)
        : null;
      let status: "upcoming" | "current" | "past" = race.status;
      if (raceDate < now) status = "past";
      else if (deadline && deadline <= now) status = "current";
      else status = "upcoming";
      return { ...race, status };
    });

    setRaces(racesWithStatus as Race[]);
    setLoading(false);
  }

  const filteredRaces = useMemo(() => {
    if (!searchQuery.trim()) return races;
    const q = searchQuery.toLowerCase();
    return races.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.venue.toLowerCase().includes(q) ||
        (r.waypoints || []).some((w) => w.toLowerCase().includes(q)),
    );
  }, [races, searchQuery]);

  const currentRaces = filteredRaces.filter((r) => r.status === "current");
  const upcomingRaces = filteredRaces
    .filter((r) => r.status === "upcoming")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastRaces = filteredRaces.filter((r) => r.status === "past");

  // Clean waypoints — remove empty strings except start/end
  function cleanWaypoints(waypoints: string[]): string[] {
    if (waypoints.length < 2) return waypoints;
    const start = waypoints[0];
    const end = waypoints[waypoints.length - 1];
    const middle = waypoints.slice(1, -1).filter(Boolean);
    return [start, ...middle, end].filter((w, i, arr) => {
      if (i === 0 || i === arr.length - 1) return true;
      return Boolean(w);
    });
  }

  async function onCreateSubmit(data: RaceFormData) {
    setSubmitting(true);
    const cleaned = cleanWaypoints(createWaypoints);
    const result = await createRace({
      title: data.title,
      date: new Date(data.date).toISOString(),
      venue: data.venue,
      start_location: cleaned[0] || null,
      end_location: cleaned[cleaned.length - 1] || null,
      waypoints: cleaned,
      registration_deadline: data.registration_deadline
        ? new Date(data.registration_deadline).toISOString()
        : undefined,
      registration_fee: data.registration_fee,
      details: data.details,
      rules: data.rules,
    });

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Race created successfully" });
      setCreateDialogOpen(false);
      createForm.reset();
      setCreateWaypoints(["", ""]);
      loadRaces();
    }
    setSubmitting(false);
  }

  async function onEditSubmit(data: RaceFormData) {
    if (!selectedRace) return;
    setSubmitting(true);
    const cleaned = cleanWaypoints(editWaypoints);
    const result = await updateRace(selectedRace.id, {
      title: data.title,
      date: new Date(data.date).toISOString(),
      venue: data.venue,
      start_location: cleaned[0] || null,
      end_location: cleaned[cleaned.length - 1] || null,
      waypoints: cleaned,
      registration_deadline: data.registration_deadline
        ? new Date(data.registration_deadline).toISOString()
        : undefined,
      registration_fee: data.registration_fee,
      details: data.details,
      rules: data.rules,
    });

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Race updated successfully" });
      setEditDialogOpen(false);
      setSelectedRace(null);
      loadRaces();
    }
    setSubmitting(false);
  }

  async function handleDelete() {
    if (!selectedRace) return;
    setSubmitting(true);
    const result = await deleteRace(selectedRace.id);
    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Race deleted successfully" });
      setDeleteDialogOpen(false);
      setSelectedRace(null);
      loadRaces();
    }
    setSubmitting(false);
  }

  function openEditDialog(race: Race) {
    setSelectedRace(race);
    // Load existing waypoints or fall back to start/end
    const existingWaypoints =
      race.waypoints && race.waypoints.length >= 2
        ? race.waypoints
        : [race.start_location || "", race.end_location || ""];
    setEditWaypoints(existingWaypoints);
    editForm.reset({
      title: race.title,
      date: new Date(race.date).toISOString().slice(0, 16),
      venue: race.venue,
      registration_deadline: race.registration_deadline
        ? new Date(race.registration_deadline).toISOString().slice(0, 16)
        : "",
      registration_fee: race.registration_fee ?? 10,
      details: race.details || "",
      rules: race.rules || "",
    });
    setEditDialogOpen(true);
  }

  // eslint-disable-next-line react/display-name

  function RouteDisplay({ race }: { race: Race }) {
    const points =
      race.waypoints && race.waypoints.filter(Boolean).length >= 2
        ? race.waypoints.filter(Boolean)
        : [race.start_location, race.end_location].filter(Boolean);

    if (points.length === 0) return null;

    return (
      <div>
        <p className="text-sm text-muted-foreground mb-1">Route</p>
        <div className="flex flex-wrap items-center gap-1 text-sm">
          {points.map((city, index) => (
            <span key={index} className="flex items-center gap-1">
              <span
                className={`font-medium ${
                  index === 0
                    ? "text-green-600"
                    : index === points.length - 1
                      ? "text-red-600"
                      : "text-blue-600"
                }`}
              >
                {city}
              </span>
              {index < points.length - 1 && (
                <span className="text-muted-foreground">→</span>
              )}
            </span>
          ))}
        </div>
      </div>
    );
  }

  function RacesTable({
    races,
    showActions = true,
  }: {
    races: Race[];
    showActions?: boolean;
  }) {
    if (races.length === 0) {
      return (
        <p className="py-8 text-center text-muted-foreground">
          No races in this category
        </p>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead className="hidden md:table-cell">Venue</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {races.map((race) => (
              <TableRow key={race.id}>
                <TableCell className="font-medium">{race.title}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {new Date(race.date).toLocaleDateString("en-US", {
                    timeZone: "America/Chicago",
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {race.venue}
                </TableCell>
                <TableCell>
                  <Badge
                  className="capitalize"
                    variant={
                      race.status === "upcoming"
                        ? "default"
                        : race.status === "current"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {race.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedRace(race);
                        setViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {showActions && (
                      <>
                        <Button
                          variant="ghost"
                          className="cursor-pointer"
                          size="icon"
                          onClick={() => openEditDialog(race)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedRace(race);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-destructive hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
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
            Race Management
          </h2>
          <p className="text-muted-foreground">
            Create, edit, and manage all races
          </p>
        </div>

        <Dialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) {
              createForm.reset();
              setCreateWaypoints(["", ""]);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="hover:shadow-sm cursor-pointer bg-[#FF0000] hover:bg-red-600">
              <Plus className="mr-2 h-4 w-4" />
              Create Race
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Create New Race
              </DialogTitle>
              <DialogDescription>
                Add a new race to the schedule
              </DialogDescription>
            </DialogHeader>
            <RaceForm
              form={createForm}
              onSubmit={onCreateSubmit}
              submitLabel="Create Race"
              waypoints={createWaypoints}
              onWaypointsChange={setCreateWaypoints}
              submitting={submitting}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search races by title, venue or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Upcoming Races
            </CardTitle>
            <Trophy className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingRaces.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Races</CardTitle>
            <Calendar className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentRaces.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Past Races</CardTitle>
            <MapPin className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pastRaces.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingRaces.length})
          </TabsTrigger>
          <TabsTrigger value="current">
            Current ({currentRaces.length})
          </TabsTrigger>
          <TabsTrigger value="past">Past ({pastRaces.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Races</CardTitle>
              <CardDescription>
                Scheduled races that haven't started yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RacesTable races={upcomingRaces} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="current">
          <Card>
            <CardHeader>
              <CardTitle>Current Races</CardTitle>
              <CardDescription>
                Races currently in progress or happening today
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RacesTable races={currentRaces} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="past">
          <Card>
            <CardHeader>
              <CardTitle>Past Races</CardTitle>
              <CardDescription>Completed races (view only)</CardDescription>
            </CardHeader>
            <CardContent>
              <RacesTable races={pastRaces} showActions={false} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Race
            </DialogTitle>
            <DialogDescription>Update race details</DialogDescription>
          </DialogHeader>
          <RaceForm
            form={editForm}
            onSubmit={onEditSubmit}
            submitLabel="Save Changes"
            waypoints={editWaypoints}
            onWaypointsChange={setEditWaypoints}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {selectedRace?.title}
            </DialogTitle>
            <DialogDescription>Race details</DialogDescription>
          </DialogHeader>
          {selectedRace && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Date & Time</p>
                  <p className="font-medium">
                    {new Date(selectedRace.date).toLocaleString("en-US", {
                      timeZone: "America/Chicago",
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Venue</p>
                  <p className="font-medium">{selectedRace.venue}</p>
                </div>

                {/* Route display */}
                {((selectedRace.waypoints &&
                  selectedRace.waypoints.filter(Boolean).length >= 2) ||
                  selectedRace.start_location ||
                  selectedRace.end_location) && (
                  <div className="sm:col-span-2">
                    <RouteDisplay race={selectedRace} />
                  </div>
                )}

                {selectedRace.registration_deadline && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Registration Deadline
                    </p>
                    <p className="font-medium">
                      {new Date(
                        selectedRace.registration_deadline,
                      ).toLocaleString("en-US", {
                        timeZone: "America/Chicago",
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        timeZoneName: "short",
                      })}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">
                    Registration Fee
                  </p>
                  <p className="font-medium text-green-600">
                    ${Number(selectedRace.registration_fee ?? 10).toFixed(2)}{" "}
                    <span className="text-xs text-muted-foreground font-normal">
                      per runner
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge>{selectedRace.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(selectedRace.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {selectedRace.details && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Details</p>
                  <p className="text-sm whitespace-pre-wrap rounded-md bg-muted p-3">
                    {selectedRace.details}
                  </p>
                </div>
              )}
              {selectedRace.rules && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Rules & Regulations
                  </p>
                  <p className="text-sm whitespace-pre-wrap rounded-md bg-muted p-3">
                    {selectedRace.rules}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Race</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedRace?.title}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
