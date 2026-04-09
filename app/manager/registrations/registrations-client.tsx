"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Calendar,
  MapPin,
  Users,
  Trophy,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
} from "lucide-react"

interface Runner {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  gender: string | null
}

interface Team {
  id: string
  name: string
  manager_id: string
  members: string[] | null
}

interface Race {
  id: string
  title: string
  date: string
  venue: string
  status: string
}

interface Registration {
  id: string
  race_id: string
  team_id: string
  sub_team_type: string
  sub_team_types?: ("male" | "female" | "co-ed")[]
  runners: string[]
  runners_by_subteam?: Record<"male" | "female" | "co-ed", string[]>
  payment_status: string
  paid_amount: number | null
  created_at: string
  race: Race | null
  team: Team | null
}

interface RegistrationsClientProps {
  registrations: Registration[]
  teams: Team[]
  runners: Runner[]
  managerId: string
}

const ITEMS_PER_PAGE = 10

// ── CT timezone date helpers ──────────────────────────────────────────────
function formatRaceDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatRaceTime(dateString: string): string {
  if (!dateString.includes("T")) return ""
  const date = new Date(dateString)
  const time = date.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  if (time === "12:00 AM") return ""
  const tzAbbr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).formatToParts(date).find((p) => p.type === "timeZoneName")?.value
  return `${time} ${tzAbbr || "CT"}`
}

function formatRegisteredOn(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
    year: "numeric",
  }) + " at " + new Date(dateString).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function RegistrationsClient({
  registrations,
  teams,
  runners,
}: RegistrationsClientProps) {
  const router = useRouter()
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [filterTeam, setFilterTeam] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("date-desc")
  const [upcomingPage, setUpcomingPage] = useState(1)
  const [pastPage, setPastPage] = useState(1)

  const getRunner = (id: string) => runners.find((r) => r.id === id)

  const getRunnerName = (id: string) => {
    const runner = getRunner(id)
    if (!runner) return "Unknown"
    if (runner.first_name || runner.last_name) {
      return `${runner.first_name || ""} ${runner.last_name || ""}`.trim()
    }
    return runner.email
  }

  const getInitials = (id: string) => {
    const runner = getRunner(id)
    if (!runner) return "?"
    return `${runner.first_name?.[0] || ""}${runner.last_name?.[0] || ""}`.toUpperCase() || runner.email[0].toUpperCase()
  }

  const categorizedRegistrations = useMemo(() => {
    const now = new Date()
    const upcoming = registrations.filter(
      (r) => r.race && new Date(r.race.date) >= now && r.race.status !== "past"
    )
    const past = registrations.filter(
      (r) => r.race && (new Date(r.race.date) < now || r.race.status === "past")
    )
    return { upcoming, past }
  }, [registrations])

  const filterAndSort = (regs: Registration[]) => {
    let filtered = [...regs]
    if (filterTeam !== "all") filtered = filtered.filter((r) => r.team_id === filterTeam)
    if (filterStatus !== "all") filtered = filtered.filter((r) => r.payment_status === filterStatus)
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-asc":  return new Date(a.race?.date || 0).getTime() - new Date(b.race?.date || 0).getTime()
        case "date-desc": return new Date(b.race?.date || 0).getTime() - new Date(a.race?.date || 0).getTime()
        case "team":      return (a.team?.name || "").localeCompare(b.team?.name || "")
        case "status":    return a.payment_status.localeCompare(b.payment_status)
        default:          return 0
      }
    })
    return filtered
  }

  const filteredUpcoming = filterAndSort(categorizedRegistrations.upcoming)
  const filteredPast = filterAndSort(categorizedRegistrations.past)

  const paginate = (items: Registration[], page: number) =>
    items.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  const getTotalPages = (items: Registration[]) => Math.ceil(items.length / ITEMS_PER_PAGE)

  const paginatedUpcoming = paginate(filteredUpcoming, upcomingPage)
  const paginatedPast = paginate(filteredPast, pastPage)

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>
      case "pending":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getSubTeamBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      male: "bg-blue-50 text-blue-700 border-blue-300",
      female: "bg-pink-50 text-pink-700 border-pink-300",
      "co-ed": "bg-accent/10 text-accent border-accent/50",
    }
    return colors[type] || ""
  }

  const getSubTeamTypes = (reg: Registration) =>
    reg.sub_team_types && reg.sub_team_types.length > 0
      ? reg.sub_team_types
      : [reg.sub_team_type as "male" | "female" | "co-ed"]

  const getSubTeamBadges = (reg: Registration) => (
    <div className="flex flex-wrap gap-1">
      {getSubTeamTypes(reg).map((type) => (
        <Badge key={type} variant="outline" className={`capitalize ${getSubTeamBadgeColor(type)}`}>
          {type}
        </Badge>
      ))}
    </div>
  )

  const getRunnersForSubTeam = (reg: Registration, subTeamType: "male" | "female" | "co-ed") => {
    if (reg.runners_by_subteam && reg.runners_by_subteam[subTeamType]) {
      return reg.runners_by_subteam[subTeamType]
    }
    const types = getSubTeamTypes(reg)
    if (types.length === 1 && types[0] === subTeamType) return reg.runners || []
    return []
  }

  const PaginationControls = ({
    currentPage, totalPages, onPageChange,
  }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) => {
    if (totalPages <= 1) return null
    return (
      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="bg-transparent">
            <ChevronLeft className="h-4 w-4 mr-1" />Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="bg-transparent">
            Next<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  const RegistrationTable = ({
    registrations, page, totalPages, onPageChange, showActions = true,
  }: {
    registrations: Registration[]; page: number; totalPages: number;
    onPageChange: (page: number) => void; showActions?: boolean
  }) => (
    <Card>
      <CardContent className="pt-6">
        {registrations.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No registrations found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Race</TableHead>
                    <TableHead className="hidden sm:table-cell">Team</TableHead>
                    <TableHead>Sub-Team</TableHead>
                    <TableHead className="hidden md:table-cell">Runners</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((reg) => {
                    const raceTime = reg.race?.date ? formatRaceTime(reg.race.date) : ""
                    return (
                      <TableRow key={reg.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{reg.race?.title || "Unknown Race"}</p>
                            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-1">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {reg.race?.date ? formatRaceDate(reg.race.date) : "No date"}
                              </div>
                              {raceTime && <span className="pl-4">{raceTime}</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-foreground">{reg.team?.name || "Unknown"}</span>
                        </TableCell>
                        <TableCell>{getSubTeamBadges(reg)}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{reg.runners?.length || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getPaymentBadge(reg.payment_status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedRegistration(reg); setDetailDialogOpen(true) }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {showActions && reg.payment_status === "pending" && (
                              <Button size="sm" variant="ghost" onClick={() => router.push(`/checkout/${reg.id}`)}>
                                <CreditCard className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
          </>
        )}
      </CardContent>
    </Card>
  )

  const totalRegistrations = registrations.length
  const paidRegistrations = registrations.filter((r) => r.payment_status === "paid").length
  const pendingPayments = registrations.filter((r) => r.payment_status === "pending").length
  const totalRunners = registrations.reduce((sum, r) => sum + (r.runners?.length || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Registrations</h1>
          <p className="text-muted-foreground mt-1">Manage race registrations for your teams</p>
        </div>
        <Button className="bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer" onClick={() => router.push("/manager/races")}>
          <Plus className="h-4 w-4 mr-2" />Register for Race
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Total Registrations", value: totalRegistrations, color: "text-foreground" },
          { label: "Paid", value: paidRegistrations, color: "text-green-600" },
          { label: "Pending Payments", value: pendingPayments, color: "text-amber-600" },
          { label: "Total Runners", value: totalRunners, color: "text-foreground" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs + Filters */}
      <Tabs defaultValue="upcoming" className="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid max-w-xs grid-cols-2">
            <TabsTrigger value="upcoming" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />Upcoming
              {filteredUpcoming.length > 0 && <Badge variant="secondary" className="ml-1">{filteredUpcoming.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="past" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />Past
              {filteredPast.length > 0 && <Badge variant="secondary" className="ml-1">{filteredPast.length}</Badge>}
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2">
            <Select value={filterTeam} onValueChange={setFilterTeam}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="All teams" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Date (Newest)</SelectItem>
                <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                <SelectItem value="team">Team Name</SelectItem>
                <SelectItem value="status">Payment Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="upcoming" className="mt-6">
          <RegistrationTable registrations={paginatedUpcoming} page={upcomingPage} totalPages={getTotalPages(filteredUpcoming)} onPageChange={setUpcomingPage} showActions={true} />
        </TabsContent>
        <TabsContent value="past" className="mt-6">
          <RegistrationTable registrations={paginatedPast} page={pastPage} totalPages={getTotalPages(filteredPast)} onPageChange={setPastPage} showActions={false} />
        </TabsContent>
      </Tabs>

      {/* No Teams Warning */}
      {teams.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">No teams created yet</p>
                <p className="text-sm text-amber-700 mt-1">Create a team first to register for races.</p>
                <Button variant="outline" size="sm" className="mt-3 bg-transparent" onClick={() => router.push("/manager/teams")}>
                  Create Team
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {selectedRegistration && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />Registration Details
                </DialogTitle>
                <DialogDescription>{selectedRegistration.race?.title || "Unknown Race"}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6 py-4">

                  {/* Race Info */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Race Information</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="text-muted-foreground">Date:</span>
                        <span className="text-foreground">
                          {selectedRegistration.race?.date ? formatRaceDate(selectedRegistration.race.date) : "N/A"}
                        </span>
                      </div>
                      {selectedRegistration.race?.date && formatRaceTime(selectedRegistration.race.date) && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-primary" />
                          <span className="text-muted-foreground">Time:</span>
                          <span className="text-foreground">{formatRaceTime(selectedRegistration.race.date)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="text-muted-foreground">Venue:</span>
                        <span className="text-foreground">{selectedRegistration.race?.venue || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Team Info */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Team Information</h4>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="text-foreground">{selectedRegistration.team?.name || "Unknown"}</span>
                      </div>
                      {getSubTeamBadges(selectedRegistration)}
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Payment</h4>
                    <div className="flex items-center gap-4">
                      {getPaymentBadge(selectedRegistration.payment_status)}
                      {selectedRegistration.paid_amount && (
                        <span className="text-sm text-muted-foreground">
                          Amount: ${selectedRegistration.paid_amount.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {selectedRegistration.payment_status === "pending" && (
                      <Button size="sm" onClick={() => { setDetailDialogOpen(false); router.push(`/checkout/${selectedRegistration.id}`) }}>
                        <CreditCard className="h-4 w-4 mr-2" />Complete Payment
                      </Button>
                    )}
                  </div>

                  {/* Runners */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-foreground">Runners ({selectedRegistration.runners?.length || 0})</h4>
                    <div className="hidden sm:grid gap-4" style={{ gridTemplateColumns: `repeat(${getSubTeamTypes(selectedRegistration).length}, minmax(0, 1fr))` }}>
                      {getSubTeamTypes(selectedRegistration).map((subTeamType) => {
                        const subTeamRunners = getRunnersForSubTeam(selectedRegistration, subTeamType)
                        return (
                          <div key={subTeamType} className="space-y-2">
                            <div className="flex items-center gap-2 pb-2 border-b-2 border-accent/30">
                              <Badge variant="outline" className={`capitalize ${getSubTeamBadgeColor(subTeamType)}`}>{subTeamType}</Badge>
                              <span className="text-xs text-muted-foreground">{subTeamRunners.length} runners</span>
                            </div>
                            <div className="space-y-2">
                              {subTeamRunners.map((runnerId, index) => {
                                const runner = getRunner(runnerId)
                                return (
                                  <div key={runnerId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
                                    <Avatar className="h-7 w-7">
                                      <AvatarFallback className="text-xs bg-accent/20 text-accent">{getInitials(runnerId)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">{index + 1}. {getRunnerName(runnerId)}</p>
                                      {runner?.gender && <p className="text-xs text-muted-foreground capitalize">{runner.gender}</p>}
                                    </div>
                                  </div>
                                )
                              })}
                              {subTeamRunners.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No runners assigned</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="sm:hidden">
                      <Accordion type="multiple" defaultValue={getSubTeamTypes(selectedRegistration)} className="space-y-2">
                        {getSubTeamTypes(selectedRegistration).map((subTeamType) => {
                          const subTeamRunners = getRunnersForSubTeam(selectedRegistration, subTeamType)
                          return (
                            <AccordionItem key={subTeamType} value={subTeamType} className="border rounded-lg border-accent/30 px-3">
                              <AccordionTrigger className="py-3 hover:no-underline">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={`capitalize ${getSubTeamBadgeColor(subTeamType)}`}>{subTeamType}</Badge>
                                  <span className="text-xs text-muted-foreground">{subTeamRunners.length} runners</span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="pb-3">
                                <div className="space-y-2">
                                  {subTeamRunners.map((runnerId, index) => {
                                    const runner = getRunner(runnerId)
                                    return (
                                      <div key={runnerId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                        <Avatar className="h-7 w-7">
                                          <AvatarFallback className="text-xs bg-accent/20 text-accent">{getInitials(runnerId)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-foreground truncate">{index + 1}. {getRunnerName(runnerId)}</p>
                                          {runner?.gender && <p className="text-xs text-muted-foreground capitalize">{runner.gender}</p>}
                                        </div>
                                      </div>
                                    )
                                  })}
                                  {subTeamRunners.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No runners assigned</p>}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          )
                        })}
                      </Accordion>
                    </div>
                  </div>

                  {/* Registered on */}
                  <div className="text-sm text-muted-foreground">
                    Registered on {formatRegisteredOn(selectedRegistration.created_at)}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
