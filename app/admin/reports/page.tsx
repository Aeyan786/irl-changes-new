"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  BarChart3,
  Download,
  TrendingUp,
  Users,
  Trophy,
  DollarSign,
  RefreshCcw,
  FileText,
  PieChart,
  CreditCard,
  FileSpreadsheet,
  X,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

interface ReportStats {
  totalUsers: number
  totalRunners: number
  totalManagers: number
  totalAdmins: number
  totalTeams: number
  totalRaces: number
  upcomingRaces: number
  pastRaces: number
  totalRegistrations: number
  paidRegistrations: number
  pendingRegistrations: number
  totalRevenue: number
}

interface MonthlyData {
  month: string
  registrations: number
  revenue: number
  newUsers: number
}

interface RaceParticipation {
  id: string
  name: string
  fullName: string
  date: string
  registrations: number
  paid: number
  pending: number
  revenue: number
}

interface AgeRangeData {
  range: string
  count: number
}

interface PaymentData {
  raceId: string
  raceName: string
  raceDate: string
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  paidCount: number
  pendingCount: number
}

interface UserRecord {
  id: string
  role: string
  age: number | null
  created_at: string
}

const CHART_COLORS = {
  primary: "#E7000B",
  secondary: "gray",
  accent: "blue",
  warning: "#DADBE1",
  purple: "green",
  muted: "green",
}

const PIE_COLORS = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.warning, CHART_COLORS.accent]

const tooltipStyle = {
  backgroundColor: "#F1E1E1",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  padding: "8px 12px",
}

export default function AdminReportsPage() {
  const [stats, setStats] = useState<ReportStats | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [raceParticipation, setRaceParticipation] = useState<RaceParticipation[]>([])
  const [ageRangeData, setAgeRangeData] = useState<AgeRangeData[]>([])
  const [paymentData, setPaymentData] = useState<PaymentData[]>([])
  const [allUsers, setAllUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("6months")
  // Selected age range for synced pie chart
  const [selectedAgeRange, setSelectedAgeRange] = useState<string | null>(null)
  const { toast } = useToast()
  const supabase = createClient()

  // Compute pie chart data based on selected age range or all users
  const userDistribution = (() => {
    const source = selectedAgeRange
      ? allUsers.filter((u) => {
          if (!u.age) return false
          const [min, max] = selectedAgeRange === "65+"
            ? [65, Infinity]
            : selectedAgeRange.split("-").map(Number)
          return u.age >= min && u.age <= max
        })
      : allUsers

    const runners = source.filter((u) => u.role === "runner").length
const managers = source.filter((u) => u.role === "manager" || u.role === "assistant_manager").length

return [
  { name: "Runners", value: runners },
  { name: "Managers", value: managers },
].filter((d) => d.value > 0)
  })()

  const fetchReportData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: users } = await supabase
        .from("users")
        .select("id, role, age, created_at")

      setAllUsers(users || [])

      const totalUsers = users?.length || 0
      const totalRunners = users?.filter((u) => u.role === "runner").length || 0
      const totalManagers = users?.filter((u) => u.role === "manager").length || 0
      const totalAdmins = users?.filter((u) => u.role === "admin").length || 0

      const ageRanges: AgeRangeData[] = [
        { range: "18-24", count: 0 },
        { range: "25-34", count: 0 },
        { range: "35-44", count: 0 },
        { range: "45-54", count: 0 },
        { range: "55-64", count: 0 },
        { range: "65+", count: 0 },
      ]

      users?.forEach((user) => {
        if (user.age) {
          if (user.age >= 18 && user.age <= 24) ageRanges[0].count++
          else if (user.age >= 25 && user.age <= 34) ageRanges[1].count++
          else if (user.age >= 35 && user.age <= 44) ageRanges[2].count++
          else if (user.age >= 45 && user.age <= 54) ageRanges[3].count++
          else if (user.age >= 55 && user.age <= 64) ageRanges[4].count++
          else if (user.age >= 65) ageRanges[5].count++
        }
      })
      setAgeRangeData(ageRanges)

      const { count: totalTeams } = await supabase
        .from("teams")
        .select("id", { count: "exact", head: true })

      const { data: races } = await supabase
        .from("races")
        .select("id, title, date, status")
        .order("date", { ascending: false })

      const totalRaces = races?.length || 0
      const now = new Date()
      const upcomingRaces = races?.filter((r) => new Date(r.date) > now).length || 0
      const pastRaces = races?.filter((r) => new Date(r.date) <= now).length || 0

      const { data: registrations } = await supabase
  .from("registrations")
  .select(`id, payment_status, created_at, race_id,
    payment:payments(amount, status)`)

      const totalRegistrations = registrations?.length || 0
      const paidRegistrations = registrations?.filter((r) => r.payment_status === "paid").length || 0
      const pendingRegistrations = registrations?.filter((r) => r.payment_status === "pending").length || 0
      const totalRevenue = registrations
  ?.filter((r) => r.payment_status === "paid")
  .reduce((sum, r) => {
    const payment = Array.isArray(r.payment) ? r.payment[0] : r.payment
    return sum + (payment?.amount || 0)
  }, 0) || 0

      setStats({
        totalUsers,
        totalRunners,
        totalManagers,
        totalAdmins,
        totalTeams: totalTeams || 0,
        totalRaces,
        upcomingRaces,
        pastRaces,
        totalRegistrations,
        paidRegistrations,
        pendingRegistrations,
        totalRevenue,
      })

      const months = timeRange === "12months" ? 12 : timeRange === "6months" ? 6 : 3
      const monthlyStats: MonthlyData[] = []

      for (let i = months - 1; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)

        const monthRegistrations = registrations?.filter((r) => {
          const created = new Date(r.created_at)
          return created >= monthStart && created <= monthEnd
        }) || []

        const monthUsers = users?.filter((u) => {
          const created = new Date(u.created_at)
          return created >= monthStart && created <= monthEnd
        }) || []

        monthlyStats.push({
          month: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
          registrations: monthRegistrations.length,
          revenue: monthRegistrations
            .filter((r) => r.payment_status === "paid")
            .reduce((sum, r) => sum + (r.amount || 0), 0),
          newUsers: monthUsers.length,
        })
      }
      setMonthlyData(monthlyStats)

      const raceStats: RaceParticipation[] = (races || []).map((race) => {
        const raceRegs = registrations?.filter((r) => r.race_id === race.id) || []
        const paidRegs = raceRegs.filter((r) => r.payment_status === "paid")
        return {
          id: race.id,
          name: race.title.length > 20 ? race.title.substring(0, 20) + "..." : race.title,
          fullName: race.title,
          date: race.date,
          registrations: raceRegs.length,
          paid: paidRegs.length,
          pending: raceRegs.filter((r) => r.payment_status === "pending").length,
          revenue: paidRegs.reduce((sum, r) => sum + (r.amount || 0), 0),
        }
      })
      setRaceParticipation(raceStats)

      const payments: PaymentData[] = (races || []).map((race) => {
        const raceRegs = registrations?.filter((r) => r.race_id === race.id) || []
        const paidRegs = raceRegs.filter((r) => r.payment_status === "paid")
        const pendingRegs = raceRegs.filter((r) => r.payment_status === "pending")
        return {
          raceId: race.id,
          raceName: race.title,
          raceDate: race.date,
          totalAmount: raceRegs.reduce((sum, r) => sum + (r.amount || 0), 0),
          paidAmount: paidRegs.reduce((sum, r) => sum + (r.amount || 0), 0),
          pendingAmount: pendingRegs.reduce((sum, r) => sum + (r.amount || 0), 0),
          paidCount: paidRegs.length,
          pendingCount: pendingRegs.length,
        }
      }).filter((p) => p.totalAmount > 0)
      setPaymentData(payments)

    } catch {
      toast({ title: "Error", description: "Failed to load report data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [supabase, timeRange, toast])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  const exportToCSV = (dataType: string) => {
    let csvContent = ""
    let filename = ""

    if (dataType === "overview") {
      csvContent = "Metric,Value\n"
      csvContent += `Total Users,${stats?.totalUsers}\n`
      csvContent += `Total Runners,${stats?.totalRunners}\n`
      csvContent += `Total Managers,${stats?.totalManagers}\n`
      csvContent += `Total Admins,${stats?.totalAdmins}\n`
      csvContent += `Total Teams,${stats?.totalTeams}\n`
      csvContent += `Total Races,${stats?.totalRaces}\n`
      csvContent += `Upcoming Races,${stats?.upcomingRaces}\n`
      csvContent += `Past Races,${stats?.pastRaces}\n`
      csvContent += `Total Registrations,${stats?.totalRegistrations}\n`
      csvContent += `Paid Registrations,${stats?.paidRegistrations}\n`
      csvContent += `Pending Registrations,${stats?.pendingRegistrations}\n`
      csvContent += `Total Revenue,$${((stats?.totalRevenue || 0) / 100).toFixed(2)}\n`
      filename = "irl-overview-report.csv"
    } else if (dataType === "users") {
      csvContent = "Age Range,Count\n"
      ageRangeData.forEach((row) => { csvContent += `${row.range},${row.count}\n` })
      csvContent += "\nRole,Count\n"
      csvContent += `Runners,${stats?.totalRunners}\n`
      csvContent += `Managers,${stats?.totalManagers}\n`
      csvContent += `Admins,${stats?.totalAdmins}\n`
      filename = "irl-user-report.csv"
    } else if (dataType === "races") {
      csvContent = "Race,Date,Total Registrations,Paid,Pending,Revenue\n"
      raceParticipation.forEach((row) => {
        csvContent += `"${row.fullName}",${new Date(row.date).toLocaleDateString()},${row.registrations},${row.paid},${row.pending},$${(row.revenue / 100).toFixed(2)}\n`
      })
      filename = "irl-race-participation-report.csv"
    } else if (dataType === "payments") {
      csvContent = "Race,Date,Total Amount,Paid Amount,Pending Amount,Paid Count,Pending Count\n"
      paymentData.forEach((row) => {
        csvContent += `"${row.raceName}",${new Date(row.raceDate).toLocaleDateString()},$${(row.totalAmount / 100).toFixed(2)},$${(row.paidAmount / 100).toFixed(2)},$${(row.pendingAmount / 100).toFixed(2)},${row.paidCount},${row.pendingCount}\n`
      })
      filename = "irl-payment-report.csv"
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    toast({ title: "Export Complete", description: `${filename} has been downloaded` })
  }

  const exportToPDF = (dataType: string) => {
    let content = ""
    let filename = ""

    if (dataType === "overview") {
      content = `IRL Platform Overview Report\nGenerated: ${new Date().toLocaleDateString()}\n\nSUMMARY\n-------\nTotal Users: ${stats?.totalUsers || 0}\n  - Runners: ${stats?.totalRunners || 0}\n  - Managers: ${stats?.totalManagers || 0}\n  - Admins: ${stats?.totalAdmins || 0}\n\nTotal Teams: ${stats?.totalTeams || 0}\n\nTotal Races: ${stats?.totalRaces || 0}\n  - Upcoming: ${stats?.upcomingRaces || 0}\n  - Past: ${stats?.pastRaces || 0}\n\nREGISTRATIONS\n-------------\nTotal: ${stats?.totalRegistrations || 0}\nPaid: ${stats?.paidRegistrations || 0}\nPending: ${stats?.pendingRegistrations || 0}\n\nREVENUE\n-------\nTotal Collected: $${((stats?.totalRevenue || 0) / 100).toLocaleString()}\n`
      filename = "irl-overview-report.txt"
    } else if (dataType === "payments") {
      content = `IRL Platform Payment Report\nGenerated: ${new Date().toLocaleDateString()}\n\n`
      paymentData.forEach((row) => {
        content += `${row.raceName}\nPaid: $${(row.paidAmount / 100).toFixed(2)} (${row.paidCount})\nPending: $${(row.pendingAmount / 100).toFixed(2)} (${row.pendingCount})\n\n`
      })
      filename = "irl-payment-report.txt"
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    toast({ title: "Export Complete", description: `${filename} has been downloaded` })
  }

  const registrationStatus = stats
    ? [
        { name: "Paid", value: stats.paidRegistrations },
        { name: "Pending", value: stats.pendingRegistrations },
      ].filter((d) => d.value > 0)
    : []

  // Custom bar shape — highlights the selected bar
  const CustomBar = (props: any) => {
    const { x, y, width, height, range } = props
    const isSelected = selectedAgeRange === range
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={isSelected ? "#b30009" : CHART_COLORS.primary}
        rx={4}
        ry={4}
        style={{ cursor: "pointer", transition: "fill 0.2s" }}
        stroke={isSelected ? "#7a0006" : "none"}
        strokeWidth={isSelected ? 2 : 0}
      />
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Analytics and insights for the IRL platform</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px] bg-white cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3months">Last 3 months</SelectItem>
              <SelectItem value="6months">Last 6 months</SelectItem>
              <SelectItem value="12months">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="cursor-pointer bg-white" onClick={() => fetchReportData()}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.totalRunners} runners, {stats?.totalManagers} managers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Races</CardTitle>
            <Trophy className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRaces || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.upcomingRaces} upcoming, {stats?.pastRaces} past</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Registrations</CardTitle>
            <FileText className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRegistrations || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.paidRegistrations} paid, {stats?.pendingRegistrations} pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${((stats?.totalRevenue || 0) / 100).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From {stats?.paidRegistrations || 0} payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 sm:w-auto">
            <TabsTrigger value="users" className="cursor-pointer">
              <Users className="mr-2 h-4 w-4 hidden sm:inline" />Users
            </TabsTrigger>
            <TabsTrigger value="races" className="cursor-pointer">
              <Trophy className="mr-2 h-4 w-4 hidden sm:inline" />Races
            </TabsTrigger>
            <TabsTrigger value="payments" className="cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4 hidden sm:inline" />Payments
            </TabsTrigger>
            <TabsTrigger value="trends" className="cursor-pointer">
              <TrendingUp className="mr-2 h-4 w-4 hidden sm:inline" />Trends
            </TabsTrigger>
          </TabsList>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="cursor-pointer bg-white">
                <Download className="mr-2 h-4 w-4" />Export All
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportToCSV("overview")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />Overview (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPDF("overview")}>
                <FileText className="mr-2 h-4 w-4" />Overview (TXT)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── User Reports Tab ── */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">User Reports</h2>
            <Button variant="outline" className="cursor-pointer bg-white" size="sm" onClick={() => exportToCSV("users")}>
              <Download className="mr-2 h-4 w-4" />Export CSV
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Pie Chart — syncs with bar selection */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>User Distribution by Role</CardTitle>
                    <CardDescription>
                      {selectedAgeRange
                        ? `Showing role breakdown for age ${selectedAgeRange}`
                        : "Click a bar to filter by age range"}
                    </CardDescription>
                  </div>
                  {selectedAgeRange && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-7 px-2 text-xs gap-1 cursor-pointer"
                      onClick={() => setSelectedAgeRange(null)}
                    >
                      <X className="h-3 w-3" />
                      Clear filter
                    </Button>
                  )}
                </div>
                {selectedAgeRange && (
                  <div className="mt-1">
                    <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                      Age {selectedAgeRange} · {userDistribution.reduce((s, d) => s + d.value, 0)} users
                    </Badge>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {userDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={userDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                        >
                          {userDistribution.map((entry, index) => (
                            <Cell
                              key={`cell-${entry.name}`}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                              stroke="hsl(var(--background))"
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: number, name: string) => [`${value} users`, name]}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          formatter={(value) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-2">
                      <Users className="h-8 w-8 opacity-30" />
                      <p className="text-sm">
                        {selectedAgeRange
                          ? `No users with age data in range ${selectedAgeRange}`
                          : "No user data available"}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bar Chart — click to filter pie */}
            <Card>
              <CardHeader>
                <CardTitle>User Age Distribution</CardTitle>
                <CardDescription>
                  Click a bar to see its role breakdown in the pie chart
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={ageRangeData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      onClick={(data) => {
                        if (data?.activePayload?.[0]) {
                          const range = data.activePayload[0].payload.range as string
                          setSelectedAgeRange((prev) => (prev === range ? null : range))
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis
                        dataKey="range"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        tickLine={{ stroke: "hsl(var(--border))" }}
                      />
                      <YAxis
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        tickLine={{ stroke: "hsl(var(--border))" }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number, _name: string, props: any) => {
                          const range = props?.payload?.range
                          const suffix = range === selectedAgeRange ? " (selected)" : " — click to filter"
                          return [`${value} users${suffix}`, "Count"]
                        }}
                        cursor={{ fill: "#F1E1E1", opacity: 0.4 }}
                      />
                      <Bar
                        dataKey="count"
                        name="Users"
                        maxBarSize={50}
                        radius={[4, 4, 0, 0]}
                        shape={(props: any) => (
                          <CustomBar {...props} range={props.range ?? props?.range ?? ageRangeData[props.index]?.range} />
                        )}
                      >
                        {ageRangeData.map((entry) => (
                          <Cell
                            key={entry.range}
                            fill={selectedAgeRange === entry.range ? "#b30009" : CHART_COLORS.primary}
                            stroke={selectedAgeRange === entry.range ? "#7a0006" : "none"}
                            strokeWidth={selectedAgeRange === entry.range ? 2 : 0}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {selectedAgeRange && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Click the same bar again or{" "}
                    <button
                      className="text-red-600 underline cursor-pointer"
                      onClick={() => setSelectedAgeRange(null)}
                    >
                      clear filter
                    </button>{" "}
                    to show all users
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary cards */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[
              { label: "Runners", value: stats?.totalRunners || 0 },
              { label: "Managers", value: stats?.totalManagers || 0 },
              { label: "Admins", value: stats?.totalAdmins || 0 },
              { label: "Teams", value: stats?.totalTeams || 0, sub: "Active teams" },
            ].map(({ label, value, sub }) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{value}</div>
                  <p className="text-xs text-muted-foreground">
                    {sub ?? (stats?.totalUsers ? ((value / stats.totalUsers) * 100).toFixed(1) + "% of users" : "0%")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Race Participation Tab */}
        <TabsContent value="races" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Race Participation</h2>
            <Button variant="outline" size="sm" onClick={() => exportToCSV("races")}>
              <Download className="mr-2 h-4 w-4" />Export CSV
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Registrations by Race</CardTitle>
              <CardDescription>Total and paid registrations per race</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={raceParticipation.slice(0, 10)} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={{ stroke: "hsl(var(--border))" }} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={{ stroke: "hsl(var(--border))" }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value} registrations`, name]} cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }} />
                    <Legend verticalAlign="top" height={36} formatter={(value) => <span style={{ color: "hsl(var(--foreground))", fontSize: 12 }}>{value}</span>} />
                    <Bar dataKey="registrations" name="Total" fill={CHART_COLORS.muted} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="paid" name="Paid" fill={CHART_COLORS.secondary} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Race Statistics</CardTitle>
              <CardDescription>Detailed breakdown by race</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/50 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3">Race</th>
                      <th className="px-4 py-3 text-right">Date</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Pending</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {raceParticipation.map((race) => (
                      <tr key={race.id} className="border-b">
                        <td className="px-4 py-3 font-medium">{race.fullName}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{new Date(race.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">{race.registrations}</td>
                        <td className="px-4 py-3 text-right"><Badge variant="default">{race.paid}</Badge></td>
                        <td className="px-4 py-3 text-right"><Badge variant="secondary">{race.pending}</Badge></td>
                        <td className="px-4 py-3 text-right font-medium">${(race.revenue / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                    {raceParticipation.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No race data available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Reports Tab */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Payment Reports</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportToCSV("payments")}><FileSpreadsheet className="mr-2 h-4 w-4" />CSV</Button>
              <Button variant="outline" size="sm" onClick={() => exportToPDF("payments")}><FileText className="mr-2 h-4 w-4" />TXT</Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Collected</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">${((stats?.totalRevenue || 0) / 100).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">From {stats?.paidRegistrations || 0} paid registrations</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pending Amount</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">${(paymentData.reduce((sum, p) => sum + p.pendingAmount, 0) / 100).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">From {stats?.pendingRegistrations || 0} pending registrations</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Average per Registration</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats?.paidRegistrations ? ((stats.totalRevenue / stats.paidRegistrations) / 100).toFixed(2) : "0.00"}</div>
                <p className="text-xs text-muted-foreground">Based on paid registrations</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment Status Distribution</CardTitle>
                <CardDescription>Breakdown of registration payment status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {registrationStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie data={registrationStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}>
                          <Cell fill={CHART_COLORS.secondary} stroke="hsl(var(--background))" strokeWidth={2} />
                          <Cell fill={CHART_COLORS.warning} stroke="hsl(var(--background))" strokeWidth={2} />
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value} registrations`, name]} />
                        <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">No payment data available</div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Race</CardTitle>
                <CardDescription>Paid amount collected per race</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentData.slice(0, 6)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="raceName" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => v.length > 10 ? v.substring(0, 10) + "..." : v} axisLine={{ stroke: "hsl(var(--border))" }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `$${v / 100}`} axisLine={{ stroke: "hsl(var(--border))" }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`$${(value / 100).toFixed(2)}`, "Revenue"]} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                      <Bar dataKey="paidAmount" name="Collected" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Payment Breakdown by Race</CardTitle>
              <CardDescription>Detailed financial breakdown per race</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/50 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3">Race</th>
                      <th className="px-4 py-3 text-right">Date</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Pending</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentData.map((payment) => (
                      <tr key={payment.raceId} className="border-b">
                        <td className="px-4 py-3 font-medium">{payment.raceName}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{new Date(payment.raceDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right"><span className="text-green-600 font-medium">${(payment.paidAmount / 100).toFixed(2)}</span><span className="text-muted-foreground text-xs ml-1">({payment.paidCount})</span></td>
                        <td className="px-4 py-3 text-right"><span className="text-amber-600 font-medium">${(payment.pendingAmount / 100).toFixed(2)}</span><span className="text-muted-foreground text-xs ml-1">({payment.pendingCount})</span></td>
                        <td className="px-4 py-3 text-right font-bold">${(payment.totalAmount / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                    {paymentData.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No payment data available</td></tr>
                    )}
                    {paymentData.length > 0 && (
                      <tr className="bg-muted/30 font-bold">
                        <td className="px-4 py-3">Total</td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right text-green-600">${(paymentData.reduce((sum, p) => sum + p.paidAmount, 0) / 100).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-amber-600">${(paymentData.reduce((sum, p) => sum + p.pendingAmount, 0) / 100).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">${(paymentData.reduce((sum, p) => sum + p.totalAmount, 0) / 100).toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Trends & Growth</h2>
            <Button variant="outline" size="sm" onClick={() => exportToCSV("overview")}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Registration Trends</CardTitle>
                <CardDescription>Monthly registration activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={{ stroke: "hsl(var(--border))" }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={{ stroke: "hsl(var(--border))" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend verticalAlign="top" height={36} formatter={(value) => <span style={{ color: "hsl(var(--foreground))", fontSize: 12 }}>{value}</span>} />
                      <Line type="monotone" dataKey="registrations" name="Registrations" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ fill: CHART_COLORS.primary, strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Monthly revenue collected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={{ stroke: "hsl(var(--border))" }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `$${v / 100}`} axisLine={{ stroke: "hsl(var(--border))" }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`$${(value / 100).toFixed(2)}`, "Revenue"]} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                      <Legend verticalAlign="top" height={36} formatter={(value) => <span style={{ color: "hsl(var(--foreground))", fontSize: 12 }}>{value}</span>} />
                      <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>User Growth</CardTitle>
              <CardDescription>New user signups over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={{ stroke: "hsl(var(--border))" }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={{ stroke: "hsl(var(--border))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend verticalAlign="top" height={36} formatter={(value) => <span style={{ color: "hsl(var(--foreground))", fontSize: 12 }}>{value}</span>} />
                    <Line type="monotone" dataKey="newUsers" name="New Users" stroke={CHART_COLORS.purple} strokeWidth={2} dot={{ fill: CHART_COLORS.purple, strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Conversion Rate</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalRegistrations ? ((stats.paidRegistrations / stats.totalRegistrations) * 100).toFixed(1) : "0"}%</div>
                <p className="text-xs text-muted-foreground">Paid vs total registrations</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Avg Revenue/Race</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats?.totalRaces ? ((stats.totalRevenue / stats.totalRaces) / 100).toFixed(2) : "0.00"}</div>
                <p className="text-xs text-muted-foreground">Average per race</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Runners/Team Ratio</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalTeams ? (stats.totalRunners / stats.totalTeams).toFixed(1) : "0"}</div>
                <p className="text-xs text-muted-foreground">Average runners per team</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
