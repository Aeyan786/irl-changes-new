"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Trophy,
  CreditCard,
  Calendar,
  TrendingUp,
  DollarSign,
  Loader2,
  ArrowDownToLine,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
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
  Legend,
} from "recharts";

type AdminInfo = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

type UserStats = {
  totalUsers: number;
  runners: number;
  managers: number;
  maleCount: number;
  femaleCount: number;
  otherCount: number;
};

type Race = {
  id: string;
  title: string;
  date: string;
  venue: string;
  status: "past" | "current" | "upcoming";
};

type Payout = {
  id: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  description: string | null;
  created_at: string;
  stripe_payout_id: string;
};

type BalanceInfo = { available: number; pending: number };

type RacesByMonth = { month: string; count: number; races: Race[] };

type PaymentSummary = {
  totalCollected: number;
  pendingAmount: number;
  payments: {
    id: string;
    amount: number;
    status: string;
    created_at: string;
    registration?: {
      race?: { title: string };
      team?: { name: string };
    };
  }[];
};

const RED = "#E7000B";
const GREY = "#6B7280";
const MUTED = "#DADBE1";

const chartConfig = {
  runners:  { label: "Runners",  color: RED   },
  managers: { label: "Managers", color: GREY  },
  male:     { label: "Male",     color: RED   },
  female:   { label: "Female",   color: GREY  },
  other:    { label: "Other",    color: MUTED },
};

// ── Stat card helper ──────────────────────────────────────────────────────────
function StatCard({
  title, value, sub, icon: Icon, iconBg, valueColor,
}: {
  title: string; value: string | number; sub: string;
  icon: React.ElementType; iconBg: string; valueColor?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={`rounded-full p-2 ${iconBg}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className={`text-2xl font-bold ${valueColor || "text-foreground"}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    totalUsers: 0, runners: 0, managers: 0,
    maleCount: 0, femaleCount: 0, otherCount: 0,
  });
  const [totalTeams, setTotalTeams] = useState(0);
  const [totalRaces, setTotalRaces] = useState(0);
  const [racesByMonth, setRacesByMonth] = useState<RacesByMonth[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary>({
    totalCollected: 0, pendingAmount: 0, payments: [],
  });
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [balance, setBalance] = useState<BalanceInfo>({ available: 0, pending: 0 });
 

  useEffect(() => {
    loadData();
    fetchPayoutData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: adminData } = await supabase
        .from("users").select("id, first_name, last_name, email, role")
        .eq("id", user.id).eq("role", "admin").single();
      if (adminData) setAdminInfo(adminData);
    }

    // Users
    const { data: users } = await supabase.from("users").select("*").neq("role", "admin");
    if (users) {
      setUserStats({
        totalUsers: users.length,
        runners:    users.filter(u => u.role === "runner").length,
        managers:   users.filter(u => u.role === "manager" || u.role === "assistant_manager").length,
        maleCount:  users.filter(u => u.gender === "male").length,
        femaleCount:users.filter(u => u.gender === "female").length,
        otherCount: users.filter(u => u.gender !== "male" && u.gender !== "female").length,
      });
    }

    // Races
    const { data: races } = await supabase.from("races").select("*").order("date", { ascending: true });
    if (races) {
      setTotalRaces(races.length);
      const monthMap = new Map<string, Race[]>();
      races.forEach(race => {
        const key = new Date(race.date).toLocaleDateString("en-US", { year: "numeric", month: "short" });
        if (!monthMap.has(key)) monthMap.set(key, []);
        monthMap.get(key)?.push(race);
      });
      setRacesByMonth(Array.from(monthMap.entries()).map(([month, r]) => ({ month, count: r.length, races: r })));
    }

    // Teams
    const { count: teamsCount } = await supabase.from("teams").select("id", { count: "exact", head: true });
    setTotalTeams(teamsCount || 0);

    // Payments — fetch ALL payments not just last 10
    const { data: payments } = await supabase
      .from("payments")
      .select(`id, amount, status, created_at,
        registration:registrations(race:races(title), team:teams(name))`)
      .order("created_at", { ascending: false });

    if (payments) {
      const totalCollected = payments
        .filter(p => p.status === "paid" || p.status === "succeeded")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const pendingAmount = payments
        .filter(p => p.status === "pending")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      setPaymentSummary({ totalCollected, pendingAmount, payments: payments as PaymentSummary["payments"] });
    }

    setLoading(false);
  }

  async function fetchPayoutData() {
    try {
      const res = await fetch("/api/create-payout");
      if (res.ok) {
        const data = await res.json();
        setPayouts(data.payouts || []);
        setBalance(data.balance || { available: 0, pending: 0 });
        console.log(data);
        
      }
    } catch (e) { console.error(e); }
  }
 
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80" /><Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const upcomingCount = racesByMonth.reduce((s, m) => s + m.races.filter(r => r.status === "upcoming").length, 0);

  const roleData = [
    { name: "Runners",  value: userStats.runners,  fill: RED  },
    { name: "Managers", value: userStats.managers, fill: GREY },
  ];
  const genderData = [
    { name: "Male",   value: userStats.maleCount,   fill: RED  },
    { name: "Female", value: userStats.femaleCount, fill: GREY },
    { name: "Other",  value: userStats.otherCount,  fill: MUTED },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "upcoming": return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Upcoming</Badge>;
      case "current":  return <Badge className="bg-green-100 text-green-700 border-green-200">Current</Badge>;
      case "past":     return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Past</Badge>;
      default:         return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "paid":
      case "succeeded": return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="mr-1 h-3 w-3" />Paid</Badge>;
      case "pending":   return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "refunded":  return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><RotateCcw className="mr-1 h-3 w-3" />Refunded</Badge>;
      case "failed":    return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>;
      default:          return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back, <span className="capitalize font-medium">{adminInfo?.first_name || "Admin"}</span>. Here is your system overview.
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users" value={userStats.totalUsers}
          sub={`${userStats.runners} runners · ${userStats.managers} managers`}
          icon={Users} iconBg="bg-blue-100" valueColor="text-foreground"
        />
        <StatCard
          title="Active Teams" value={totalTeams}
          sub="Registered teams"
          icon={Users} iconBg="bg-purple-100" valueColor="text-foreground"
        />
        <StatCard
          title="Total Races" value={totalRaces}
          sub={`${upcomingCount} upcoming`}
          icon={Trophy} iconBg="bg-orange-100" valueColor="text-foreground"
        />
        <StatCard
          title="Revenue Collected" value={`$${paymentSummary.totalCollected.toFixed(2)}`}
          sub={`$${paymentSummary.pendingAmount.toFixed(2)} pending`}
          icon={DollarSign} iconBg="bg-green-100" valueColor="text-green-600"
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-red-600" />Users by Role
            </CardTitle>
            <CardDescription>Distribution of user types</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={roleData} cx="50%" cy="45%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value">
                    {roleData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Legend
                    iconType="circle"
                    formatter={(value, entry: any) => (
                      <span style={{ color: "#374151", fontSize: 13 }}>
                        {value}: <strong>{entry.payload.value}</strong> ({((entry.payload.value / userStats.totalUsers) * 100).toFixed(0)}%)
                      </span>
                    )}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-red-600" />Users by Gender
            </CardTitle>
            <CardDescription>Gender distribution across all users</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={genderData} cx="50%" cy="45%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value">
                    {genderData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Legend
                    iconType="circle"
                    formatter={(value, entry: any) => (
                      <span style={{ color: "#374151", fontSize: 13 }}>
                        {value}: <strong>{entry.payload.value}</strong> ({userStats.totalUsers ? ((entry.payload.value / userStats.totalUsers) * 100).toFixed(0) : 0}%)
                      </span>
                    )}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Races by Month Bar Chart ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-red-600" />Races by Month
          </CardTitle>
          <CardDescription>Race distribution throughout the year</CardDescription>
        </CardHeader>
        <CardContent>
          {racesByMonth.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={racesByMonth} margin={{ left: -10, right: 8, top: 8 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" name="Races" fill={RED} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              No races scheduled yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Race Schedule ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-red-600" />Race Schedule
          </CardTitle>
          <CardDescription>All races organised by month</CardDescription>
        </CardHeader>
        <CardContent>
          {racesByMonth.length > 0 ? (
            <div className="space-y-6">
              {racesByMonth.map(monthData => (
                <div key={monthData.month}>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">
                    {monthData.month}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({monthData.count} race{monthData.count !== 1 ? "s" : ""})
                    </span>
                  </h4>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead className="hidden sm:table-cell">Date</TableHead>
                          <TableHead className="hidden md:table-cell">Venue</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthData.races.map(race => (
                          <TableRow key={race.id}>
                            <TableCell className="font-medium">{race.title}</TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">
                              {new Date(race.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                              {race.venue}
                            </TableCell>
                            <TableCell>{getStatusBadge(race.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">No races found</p>
          )}
        </CardContent>
      </Card>

      {/* ── Collected Funds ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4 text-red-600" />Collected Funds
              </CardTitle>
              <CardDescription>Stripe balance and payout history</CardDescription>
            </div>
     
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-6 overflow-x-auto">
            <div className="rounded-lg border p-4 bg-green-50 border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 font-medium">Available</span>
              </div>
              <p className="text-2xl font-bold text-green-600">${balance.available.toFixed(2)}</p>
              <p className="text-xs text-green-600 mt-1">Ready to withdraw</p>
            </div>
            <div className="rounded-lg border p-4 bg-yellow-50 border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-700 font-medium">Stripe Pending</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">${balance.pending.toFixed(2)}</p>
              <p className="text-xs text-yellow-600 mt-1">Processing in Stripe</p>
            </div>
            <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-700 font-medium">Platform Collected</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">${paymentSummary.totalCollected.toFixed(2)}</p>
              <p className="text-xs text-blue-600 mt-1">Verified payments</p>
            </div>
          </div>

          {payouts.length > 0 && (
            <>
              <h4 className="mb-3 text-sm font-semibold text-foreground">Recent Withdrawals</h4>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Description</TableHead>
                      <TableHead className="hidden md:table-cell">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.slice(0, 5).map(payout => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium">${payout.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          {payout.status === "paid"    && <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="mr-1 h-3 w-3" />Paid</Badge>}
                          {payout.status === "pending" && <Badge className="bg-yellow-100 text-yellow-700"><Clock className="mr-1 h-3 w-3" />Pending</Badge>}
                          {payout.status === "failed"  && <Badge className="bg-red-100 text-red-700"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{payout.description || "Withdrawal"}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{new Date(payout.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Recent Payments ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-red-600" />Recent Payments
          </CardTitle>
          <CardDescription>
            {paymentSummary.totalCollected > 0
              ? `$${paymentSummary.totalCollected.toFixed(2)} collected · $${paymentSummary.pendingAmount.toFixed(2)} pending`
              : `$${paymentSummary.pendingAmount.toFixed(2)} pending`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentSummary.payments.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Race</TableHead>
                    <TableHead className="hidden sm:table-cell">Team</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentSummary.payments.slice(0, 10).map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium max-w-[140px] truncate">
                        {payment.registration?.race?.title || "Unknown Race"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {payment.registration?.team?.name || "Unknown Team"}
                      </TableCell>
                      <TableCell className="font-medium">${Number(payment.amount).toFixed(2)}</TableCell>
                      <TableCell>{getPaymentBadge(payment.status)}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">No payments recorded yet</p>
          )}
        </CardContent>
      </Card>

    
    </div>
  );
}
