"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trophy, Calendar, MapPin, Clock, Timer, Eye, TrendingUp, Medal, Activity } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts"
import type { RaceResult, TeamInfo } from "./page"

interface ResultsClientProps {
  userId: string
  results: RaceResult[]
  teams: TeamInfo[]
  teamRegistrations: Record<string, string>
  hasError: boolean
}

function formatTime(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "--:--"
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function formatDate(dateString: string): string {
  if (!dateString) return "N/A"
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function getPositionBadgeVariant(position: number | null): "default" | "secondary" | "outline" {
  if (!position) return "outline"
  if (position === 1) return "default"
  if (position <= 3) return "secondary"
  return "outline"
}

function getPositionLabel(position: number | null): string {
  if (!position) return "N/A"
  const suffix = position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"
  return `${position}${suffix}`
}

// Placeholder component for when no data is available
function NoDataPlaceholder() {
  return (
    <Card className="border-2 border-dashed border-red-100 bg-gradient-to-b from-red-50/50 to-white">
      <CardContent className="flex flex-col items-center justify-center py-16 px-6">
        {/* Trophy icon with animated pulse ring */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-red-100 animate-ping opacity-30" />
          <div className="relative rounded-full bg-red-100 p-5">
            <Trophy className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <h3 className="text-xl font-bold text-foreground mb-2">Your race history starts here</h3>
        <p className="text-muted-foreground text-center max-w-sm text-sm mb-8">
          Performance tracking, personal records, and detailed race stats are coming soon.
        </p>

        {/* Fake stat cards with lock overlay */}
        <div className="w-full max-w-md space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Medal, label: "Best Position", value: "—" },
              { icon: Timer, label: "Best Time", value: "—" },
              { icon: TrendingUp, label: "Races Run", value: "0" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border bg-white p-3 text-center shadow-sm">
                <Icon className="h-5 w-5 mx-auto mb-1 text-red-300" />
                <p className="text-lg font-bold text-muted-foreground/50">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Fake chart bar preview */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground mb-3">Performance Over Time</p>
            <div className="flex items-end gap-2 h-16">
              {[30, 50, 40, 70, 55, 80, 60].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm bg-red-100"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-red-300" />
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Performance chart component
function PerformanceChart({ results }: { results: RaceResult[] }) {
  // Sort by date for the chart
  const sortedResults = [...results].sort(
    (a, b) => new Date(a.race_date).getTime() - new Date(b.race_date).getTime()
  )

  const chartData = sortedResults.map((result, index) => ({
    name: result.race_title.length > 15 ? `${result.race_title.substring(0, 15)}...` : result.race_title,
    fullName: result.race_title,
    totalTime: result.total_time,
    totalTimeFormatted: formatTime(result.total_time),
    position: result.finish_position || 0,
    date: formatDate(result.race_date),
    index: index + 1,
  }))

  if (chartData.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Trend
          </CardTitle>
          <CardDescription>Complete more races to see your performance trend</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Need at least 2 races to show trend</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Performance Trend
        </CardTitle>
        <CardDescription>Your race times over time (lower is better)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="index" 
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickLine={{ stroke: "hsl(var(--muted-foreground))" }}
                label={{ value: "Race #", position: "insideBottom", offset: -5, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickLine={{ stroke: "hsl(var(--muted-foreground))" }}
                tickFormatter={(value) => formatTime(value)}
                label={{ value: "Time", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  color: "hsl(var(--card-foreground))",
                }}
                formatter={(value: number) => [formatTime(value), "Total Time"]}
                labelFormatter={(label, payload) => payload[0]?.payload?.fullName || `Race ${label}`}
              />
              <Line
                type="monotone"
                dataKey="totalTime"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Leg times chart for a single race
function LegTimesChart({ result }: { result: RaceResult }) {
  if (!result.leg_times || result.leg_times.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No leg time data available for this race
      </div>
    )
  }

  const chartData = result.leg_times.map((time, index) => ({
    leg: `Leg ${index + 1}`,
    time: time,
    timeFormatted: formatTime(time),
  }))

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="leg" 
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis 
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(value) => formatTime(value)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
              color: "hsl(var(--card-foreground))",
            }}
            formatter={(value: number) => [formatTime(value), "Time"]}
          />
          <Bar dataKey="time" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Stats summary card
function StatsSummary({ results }: { results: RaceResult[] }) {
  const totalRaces = results.length
  const bestPosition = results.reduce((best, r) => {
    if (!r.finish_position) return best
    if (!best) return r.finish_position
    return r.finish_position < best ? r.finish_position : best
  }, null as number | null)
  const bestTime = results.reduce((best, r) => {
    if (!r.total_time || r.total_time <= 0) return best
    if (!best) return r.total_time
    return r.total_time < best ? r.total_time : best
  }, null as number | null)
  const avgTime = results.length > 0 
    ? results.reduce((sum, r) => sum + (r.total_time || 0), 0) / results.length 
    : null

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Races</p>
              <p className="text-2xl font-bold">{totalRaces}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Medal className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Best Position</p>
              <p className="text-2xl font-bold">{bestPosition ? getPositionLabel(bestPosition) : "--"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Timer className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Best Time</p>
              <p className="text-2xl font-bold">{bestTime ? formatTime(bestTime) : "--"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Time</p>
              <p className="text-2xl font-bold">{avgTime ? formatTime(avgTime) : "--"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Race result card for mobile view
function ResultCard({ 
  result, 
  teamName 
}: { 
  result: RaceResult
  teamName: string | null
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{result.race_title}</h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(result.race_date)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {result.race_venue}
              </span>
            </div>
            {teamName && (
              <p className="text-sm text-muted-foreground mt-1">Team: {teamName}</p>
            )}
          </div>
          <Badge variant={getPositionBadgeVariant(result.finish_position)}>
            {getPositionLabel(result.finish_position)}
          </Badge>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Time</p>
              <p className="font-semibold">{formatTime(result.total_time)}</p>
            </div>
            {result.leg_times && result.leg_times.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Legs</p>
                <p className="font-semibold">{result.leg_times.length}</p>
              </div>
            )}
          </div>
          
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-1" />
                Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{result.race_title}</DialogTitle>
                <DialogDescription>
                  {formatDate(result.race_date)} - {result.race_venue}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Position</p>
                    <p className="font-semibold text-lg">{getPositionLabel(result.finish_position)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Time</p>
                    <p className="font-semibold text-lg">{formatTime(result.total_time)}</p>
                  </div>
                </div>

                {result.leg_times && result.leg_times.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Leg Times</p>
                    <LegTimesChart result={result} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {result.leg_times.map((time, index) => (
                        <Badge key={index} variant="secondary">
                          Leg {index + 1}: {formatTime(time)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {result.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="mt-1">{result.notes}</p>
                  </div>
                )}

                {teamName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Team</p>
                    <p className="mt-1">{teamName}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}

export function ResultsClient({
  userId,
  results,
  teams,
  teamRegistrations,
  hasError,
}: ResultsClientProps) {
  // Get team name for a race
  const getTeamName = (raceId: string): string | null => {
    const teamId = teamRegistrations[raceId]
    if (!teamId) return null
    const team = teams.find((t) => t.id === teamId)
    return team?.name || null
  }

  if (hasError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Results</h1>
          <p className="text-muted-foreground">View your race performance and history</p>
        </div>
        <Card className="border-destructive">
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-destructive">Error loading results. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Results</h1>
          <p className="text-muted-foreground">View your race performance and history</p>
        </div>
        <NoDataPlaceholder />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Results</h1>
        <p className="text-muted-foreground">View your race performance and history</p>
      </div>

      {/* Stats Summary */}
      <StatsSummary results={results} />

      {/* Performance Chart */}
      <PerformanceChart results={results} />

      {/* Results Tabs */}
      <Tabs defaultValue="cards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cards">Cards View</TabsTrigger>
          <TabsTrigger value="table">Table View</TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="space-y-4">
          <h2 className="text-lg font-semibold">Past Race Results</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((result) => (
              <ResultCard
                key={result.id}
                result={result}
                teamName={getTeamName(result.race_id)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Past Race Results</CardTitle>
              <CardDescription>All your completed races and performance data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Race</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                      <TableHead className="hidden md:table-cell">Venue</TableHead>
                      <TableHead className="hidden lg:table-cell">Team</TableHead>
                      <TableHead className="text-center">Position</TableHead>
                      <TableHead className="text-right">Total Time</TableHead>
                      <TableHead className="hidden sm:table-cell text-center">Legs</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => {
                      const teamName = getTeamName(result.race_id)
                      return (
                        <TableRow key={result.id}>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {result.race_title}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {formatDate(result.race_date)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {result.race_venue}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {teamName || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getPositionBadgeVariant(result.finish_position)}>
                              {getPositionLabel(result.finish_position)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatTime(result.total_time)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-center">
                            {result.leg_times?.length || 0}
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                  <span className="sr-only">View details</span>
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>{result.race_title}</DialogTitle>
                                  <DialogDescription>
                                    {formatDate(result.race_date)} - {result.race_venue}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Position</p>
                                      <p className="font-semibold text-lg">
                                        {getPositionLabel(result.finish_position)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Total Time</p>
                                      <p className="font-semibold text-lg">
                                        {formatTime(result.total_time)}
                                      </p>
                                    </div>
                                  </div>

                                  {result.leg_times && result.leg_times.length > 0 && (
                                    <div>
                                      <p className="text-sm text-muted-foreground mb-2">Leg Times</p>
                                      <LegTimesChart result={result} />
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {result.leg_times.map((time, index) => (
                                          <Badge key={index} variant="secondary">
                                            Leg {index + 1}: {formatTime(time)}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {result.notes && (
                                    <div>
                                      <p className="text-sm text-muted-foreground">Notes</p>
                                      <p className="mt-1">{result.notes}</p>
                                    </div>
                                  )}

                                  {teamName && (
                                    <div>
                                      <p className="text-sm text-muted-foreground">Team</p>
                                      <p className="mt-1">{teamName}</p>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
