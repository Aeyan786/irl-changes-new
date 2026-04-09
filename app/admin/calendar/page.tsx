"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createRace, updateRace, deleteRace } from "@/app/actions/races"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventClickArg, DateSelectArg } from "@fullcalendar/core"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Pencil,
  Trash2,
  Trophy,
  Calendar,
  MapPin,
  Loader2,
  Clock,
} from "lucide-react"

type Race = {
  id: string
  title: string
  date: string
  venue: string
  details: string | null
  rules: string | null
  status: "past" | "current" | "upcoming"
  created_at: string
}

const raceSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  date: z.string().min(1, "Date is required"),
  venue: z.string().min(1, "Venue is required").max(200, "Venue too long"),
  details: z.string().optional(),
  rules: z.string().optional(),
})

type RaceFormData = z.infer<typeof raceSchema>

export default function AdminCalendarPage() {
  const [loading, setLoading] = useState(true)
  const [races, setRaces] = useState<Race[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedRace, setSelectedRace] = useState<Race | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const createForm = useForm<RaceFormData>({
    resolver: zodResolver(raceSchema),
    defaultValues: {
      title: "",
      date: "",
      venue: "",
      details: "",
      rules: "",
    },
  })

  const editForm = useForm<RaceFormData>({
    resolver: zodResolver(raceSchema),
  })

  const loadRaces = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("races")
      .select("*")
      .order("date", { ascending: true })

    const now = new Date()
    const racesWithStatus = (data || []).map((race) => {
      const raceDate = new Date(race.date)
      const deadline = race.registration_deadline
        ? new Date(race.registration_deadline)
        : null
      let status: "upcoming" | "current" | "past" = race.status
      if (raceDate < now) {
        status = "past"
      } else if (deadline && deadline <= now) {
        status = "current"
      } else {
        status = "upcoming"
      }
      return { ...race, status }
    })

    setRaces(racesWithStatus as Race[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRaces()
  }, [loadRaces])

  // Event colors following spec: Upcoming (green), Current (blue), Past (gray)
  const EVENT_COLORS = {
    upcoming: { bg: "#22c55e", border: "#16a34a", text: "#ffffff" }, // Green
    current: { bg: "#0070f3", border: "#0060df", text: "#ffffff" },  // Blue
    past: { bg: "#9ca3af", border: "#6b7280", text: "#ffffff" },     // Gray
  }

  // Map races to FullCalendar events
  const events = races.map((race) => ({
  id: race.id,
  title: race.title,
  start: race.date.split("T")[0], // date-only string prevents timezone offset display
    backgroundColor: EVENT_COLORS[race.status].bg,
    borderColor: EVENT_COLORS[race.status].border,
    textColor: EVENT_COLORS[race.status].text,
    extendedProps: {
      venue: race.venue,
      status: race.status,
      details: race.details,
      rules: race.rules,
    },
  }))

  function handleEventClick(info: EventClickArg) {
    const race = races.find((r) => r.id === info.event.id)
    if (race) {
      setSelectedRace(race)
      setViewDialogOpen(true)
    }
  }

  function handleDateSelect(selectInfo: DateSelectArg) {
    setSelectedDate(selectInfo.startStr)
    createForm.reset({
      title: "",
      date: selectInfo.startStr + "T09:00",
      venue: "",
      details: "",
      rules: "",
    })
    setCreateDialogOpen(true)
  }

  async function onCreateSubmit(data: RaceFormData) {
    setSubmitting(true)
    const result = await createRace({
      title: data.title,
      date: new Date(data.date).toISOString(),
      venue: data.venue,
      details: data.details,
      rules: data.rules,
    })

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Race created successfully",
      })
      setCreateDialogOpen(false)
      createForm.reset()
      loadRaces()
    }
    setSubmitting(false)
  }

  async function onEditSubmit(data: RaceFormData) {
    if (!selectedRace) return
    setSubmitting(true)

    const result = await updateRace(selectedRace.id, {
      title: data.title,
      date: new Date(data.date).toISOString(),
      venue: data.venue,
      details: data.details,
      rules: data.rules,
    })

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Race updated successfully",
      })
      setEditDialogOpen(false)
      setViewDialogOpen(false)
      setSelectedRace(null)
      loadRaces()
    }
    setSubmitting(false)
  }

  async function handleDelete() {
    if (!selectedRace) return
    setSubmitting(true)

    const result = await deleteRace(selectedRace.id)

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Race deleted successfully",
      })
      setDeleteDialogOpen(false)
      setViewDialogOpen(false)
      setSelectedRace(null)
      loadRaces()
    }
    setSubmitting(false)
  }

  function openEditDialog() {
    if (!selectedRace) return
    editForm.reset({
      title: selectedRace.title,
      date: new Date(selectedRace.date).toISOString().slice(0, 16),
      venue: selectedRace.venue,
      details: selectedRace.details || "",
      rules: selectedRace.rules || "",
    })
    setViewDialogOpen(false)
    setEditDialogOpen(true)
  }

  function openDeleteDialog() {
    setViewDialogOpen(false)
    setDeleteDialogOpen(true)
  }

  function RaceForm({
    form,
    onSubmit,
    submitLabel,
  }: {
    form: ReturnType<typeof useForm<RaceFormData>>
    onSubmit: (data: RaceFormData) => void
    submitLabel: string
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
  <Label htmlFor="date">Date & Time * <span className="text-xs font-normal text-muted-foreground ml-1">(Central Time)</span></Label>
  <Input id="date" type="datetime-local" {...form.register("date")} className="[color-scheme:light]" />
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

        <div className="space-y-2">
          <Label htmlFor="details">Details</Label>
          <Textarea
            id="details"
            {...form.register("details")}
            placeholder="Race description, categories, prizes, etc."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rules">Rules & Regulations</Label>
          <Textarea
            id="rules"
            {...form.register("rules")}
            placeholder="Race rules, eligibility, etc."
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button className="bg-[#EE0505] hover:bg-red-700 hover:shadow-lg  cursor-pointer" type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </form>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-[600px]" />
      </div>
    )
  }

  const upcomingCount = races.filter((r) => r.status === "upcoming").length
  const currentCount = races.filter((r) => r.status === "current").length
  const pastCount = races.filter((r) => r.status === "past").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Race Calendar
          </h2>
          <p className="text-muted-foreground">
            View and manage races on the calendar
          </p>
        </div>

        <Button
          onClick={() => {
            createForm.reset({
              title: "",
              date: "",
              venue: "",
              details: "",
              rules: "",
            })
            setCreateDialogOpen(true)
          }}
          className="bg-[#FF0000] hover:bg-red-600 hover:shadow-sm  cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Race
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Trophy className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Past</CardTitle>
            <Calendar className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pastCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Legend - Above Calendar */}
      <Card className="border-border/50">
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-foreground">
              Event Legend
            </span>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <div 
                  className="h-4 w-4 rounded shadow-sm" 
                  style={{ backgroundColor: EVENT_COLORS.upcoming.bg }}
                />
                <span className="text-sm text-foreground">Upcoming</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="h-4 w-4 rounded shadow-sm" 
                  style={{ backgroundColor: EVENT_COLORS.current.bg }}
                />
                <span className="text-sm text-foreground">Current</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="h-4 w-4 rounded shadow-sm" 
                  style={{ backgroundColor: EVENT_COLORS.past.bg }}
                />
                <span className="text-sm text-foreground">Past</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Race Schedule
          </CardTitle>
          <CardDescription>
            Click on a date to add a race, or click an event to view details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="fc-wrapper">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              events={events}
              eventClick={handleEventClick}
              selectable={true}
              select={handleDateSelect}
              editable={false}
              droppable={false}
              eventStartEditable={false}
              eventDurationEditable={false}
              height="auto"
              aspectRatio={1.8}
              eventDisplay="block"
              dayMaxEvents={3}
              moreLinkClick="popover"
              eventTimeFormat={{
                hour: "numeric",
                minute: "2-digit",
                meridiem: "short",
              }}
              slotLabelFormat={{
                hour: "numeric",
                minute: "2-digit",
                meridiem: "short",
              }}
            />
          </div>
        </CardContent>
      </Card>

      

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Create New Race
            </DialogTitle>
            <DialogDescription>Add a new race to the schedule</DialogDescription>
          </DialogHeader>
          <RaceForm
            form={createForm}
            onSubmit={onCreateSubmit}
            submitLabel="Create Race"
          />
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {selectedRace.venue}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    variant={
                      selectedRace.status === "upcoming"
                        ? "default"
                        : selectedRace.status === "current"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {selectedRace.status}
                  </Badge>
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
                  <p className="text-sm text-muted-foreground mb-1">Rules</p>
                  <p className="text-sm whitespace-pre-wrap rounded-md bg-muted p-3">
                    {selectedRace.rules}
                  </p>
                </div>
              )}

              {/* Actions for non-past races */}
              {selectedRace.status !== "past" && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={openEditDialog} className="flex-1">
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={openDeleteDialog}
                    className="flex-1"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
          />
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

      {/* Calendar Styles */}
      <style jsx global>{`
        .fc-wrapper {
          --fc-border-color: hsl(var(--border));
          --fc-button-bg-color: #0070f3;
          --fc-button-border-color: #0070f3;
          --fc-button-hover-bg-color: #0060df;
          --fc-button-hover-border-color: #0060df;
          --fc-button-active-bg-color: #0050c0;
          --fc-button-active-border-color: #0050c0;
          --fc-today-bg-color: rgba(0, 112, 243, 0.1);
          --fc-page-bg-color: hsl(var(--background));
          --fc-neutral-bg-color: hsl(var(--muted));
          --fc-list-event-hover-bg-color: hsl(var(--accent));
        }

        .fc .fc-button {
          font-weight: 500;
          font-size: 0.875rem;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          transition: all 0.15s ease;
        }

        .fc .fc-button:focus {
          box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px #0070f3;
        }

        .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc .fc-button-primary:not(:disabled):active {
          background-color: #0050c0;
          border-color: #0050c0;
        }

        .fc .fc-toolbar-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: hsl(var(--foreground));
        }

        .fc .fc-col-header-cell-cushion {
          color: hsl(var(--muted-foreground));
          font-weight: 500;
          padding: 0.5rem;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }

        .fc .fc-daygrid-day-number {
          color: hsl(var(--foreground));
          padding: 0.5rem;
          font-weight: 500;
        }

        .fc .fc-daygrid-day.fc-day-today {
          background-color: rgba(0, 112, 243, 0.08);
        }

        .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
          background-color: #0070f3;
          color: white;
          border-radius: 50%;
          width: 1.75rem;
          height: 1.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0.25rem;
        }

        .fc .fc-event {
          border-radius: 0.375rem;
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.1s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .fc .fc-event:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        }

        .fc .fc-more-link {
          color: #0070f3;
          font-weight: 600;
          font-size: 0.75rem;
        }

        .fc .fc-more-link:hover {
          text-decoration: underline;
        }

        .fc .fc-scrollgrid {
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .fc-theme-standard td,
        .fc-theme-standard th {
          border-color: hsl(var(--border));
        }

        .fc-direction-ltr .fc-toolbar > * > :not(:first-child) {
          margin-left: 0.5rem;
        }

        /* Time grid styles */
        .fc .fc-timegrid-slot-label {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
        }

        .fc .fc-timegrid-axis-cushion {
          color: hsl(var(--muted-foreground));
        }

        /* Mobile responsive styles */
        @media (max-width: 768px) {
          .fc .fc-toolbar {
            flex-direction: column;
            gap: 0.75rem;
          }

          .fc .fc-toolbar-title {
            font-size: 1.125rem;
            order: -1;
          }

          .fc .fc-button {
            padding: 0.375rem 0.625rem;
            font-size: 0.75rem;
          }

          .fc .fc-col-header-cell-cushion {
            font-size: 0.625rem;
            padding: 0.375rem;
          }

          .fc .fc-daygrid-day-number {
            font-size: 0.75rem;
            padding: 0.25rem;
          }

          .fc .fc-event {
            font-size: 0.625rem;
            padding: 0.125rem 0.25rem;
          }

          .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
            width: 1.5rem;
            height: 1.5rem;
            font-size: 0.75rem;
          }
        }

        @media (max-width: 480px) {
          .fc .fc-toolbar-chunk {
            display: flex;
            justify-content: center;
          }

          .fc .fc-button-group {
            flex-wrap: wrap;
            justify-content: center;
            gap: 0.25rem;
          }

          .fc .fc-toolbar-title {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  )
}
